import { supabaseAdmin } from "../config/supabase";

export interface Tool {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category_id: string;
  image: string;
  images?: string[];
  price_per_day: number;
  available: boolean;
  quantity: number;
  min_days: number;
  max_days: number;
  rating?: number;
  rating_count?: number;
}

function mapRow(row: any): Tool {
  if (!row) return row;
  let parsedImages: string[] = [];
  if (Array.isArray(row.images)) {
    parsedImages = row.images;
  } else if (typeof row.images === "string" && row.images.trim()) {
    try {
      parsedImages = JSON.parse(row.images);
    } catch {
      parsedImages = [];
    }
  }
  return {
    ...row,
    image: row.image || row.image_url || "",
    images: parsedImages,
    min_days: row.min_days ?? 1,
    max_days: row.max_days ?? 30,
  };
}

let cachedColumns: string[] | null = null;

async function getToolColumns(): Promise<string[]> {
  if (cachedColumns) return cachedColumns;
  try {
    const { data, error } = await supabaseAdmin.from("tools").select("*").limit(1);
    if (!error && data && data.length > 0) {
      cachedColumns = Object.keys(data[0]);
      return cachedColumns;
    }
  } catch (err) {
    console.error("[getToolColumns] Error fetching columns:", err);
  }
  return ["id", "company_id", "name", "description", "category_id", "image", "images", "price_per_day", "available", "quantity", "min_days", "max_days"];
}

// SECURITY FIX (HIGH-04): SSRF Protection — allowlist of trusted image hosting domains
const ALLOWED_IMAGE_DOMAINS = [
  "imgur.com", "i.imgur.com",
  "unsplash.com", "images.unsplash.com",
  "cloudinary.com", "res.cloudinary.com",
  "firebasestorage.googleapis.com",
  "supabase.co", "supabase.com",
  "gravatar.com",
  "picsum.photos",
  "pexels.com", "images.pexels.com",
  "pixabay.com",
];

/**
 * SECURITY FIX (HIGH-04): Check if a URL's hostname is in the allowlist.
 * Blocks private/reserved IPs and only allows trusted image domains.
 */
function isUrlAllowed(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    // Block private/reserved IP ranges (SSRF protection)
    const privatePatterns = [
      /^127\./,                          // Loopback
      /^10\./,                           // Class A private
      /^172\.(1[6-9]|2\d|3[01])\./,     // Class B private
      /^192\.168\./,                     // Class C private
      /^169\.254\./,                     // Link-local (AWS metadata!)
      /^0\./,                            // Current network
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Shared address space
      /^::1$/,                           // IPv6 loopback
      /^fc00:/i, /^fd00:/i,             // IPv6 private
      /^fe80:/i,                         // IPv6 link-local
    ];
    if (privatePatterns.some(p => p.test(hostname))) {
      console.warn(`[Security] SSRF blocked: private/reserved IP "${hostname}"`);
      return false;
    }

    // Block localhost variants
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
      console.warn(`[Security] SSRF blocked: localhost "${hostname}"`);
      return false;
    }

    // Only allow HTTPS (no HTTP fetches from server)
    if (parsed.protocol !== "https:") {
      console.warn(`[Security] SSRF blocked: non-HTTPS protocol "${parsed.protocol}"`);
      return false;
    }

    // Check domain allowlist
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      console.warn(`[Security] SSRF blocked: domain "${hostname}" not in allowlist`);
    }
    return isAllowed;
  } catch {
    return false;
  }
}

async function resolveImageUrl(url: string): Promise<string> {
  if (!url) return url;
  
  let cleanUrl = url.trim();
  // Return Base64 Data URIs directly without prepending https://
  if (/^data:image\//i.test(cleanUrl)) {
    return cleanUrl;
  }
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  // If already a direct image link, return it (no fetch needed)
  const isDirectImage = /\.(png|jpe?g|gif|webp|svg)(?:\?.*)?$/i.test(cleanUrl);
  if (isDirectImage) {
    return cleanUrl;
  }

  // SECURITY FIX (HIGH-04): Only fetch URLs from allowed domains
  if (!isUrlAllowed(cleanUrl)) {
    return cleanUrl; // Return as-is without fetching
  }

  // Fetch with timeout to prevent slow-loris attacks
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

  try {
    // Special resolver for Imgur pages and albums using fetch and parsing meta og:image
    if (/imgur\.com/i.test(cleanUrl)) {
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: controller.signal,
        });
        if (response.ok) {
          const html = await response.text();
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            let ogUrl = ogImageMatch[1];
            ogUrl = ogUrl.replace(/\?fb$/, ""); // remove Facebook tracker
            return ogUrl;
          }

          const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) || 
                                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
          if (twitterImageMatch && twitterImageMatch[1]) {
            return twitterImageMatch[1];
          }
        }
      } catch (err) {
        console.error("[resolveImageUrl] Error fetching Imgur URL:", err);
      }
    }

    // General resolver for other allowed webpages
    if (/^https?:\/\//i.test(cleanUrl)) {
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: controller.signal,
        });
        if (response.ok) {
          const html = await response.text();
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                              html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            return ogImageMatch[1];
          }
        }
      } catch (err) {
        console.error("[resolveImageUrl] Error resolving general URL:", err);
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return cleanUrl;
}

function triggerBackgroundResolution(tool: Tool) {
  if (!tool.image) return;
  const isDirectImage = /\.(png|jpe?g|gif|webp|svg)(?:\?.*)?$/i.test(tool.image);
  if (!isDirectImage && /^https?:\/\//i.test(tool.image)) {
    (async () => {
      try {
        const resolved = await resolveImageUrl(tool.image);
        if (resolved && resolved !== tool.image) {
          const columns = await getToolColumns();
          const updateData: any = {};
          if (columns.includes("image")) updateData.image = resolved;
          if (columns.includes("image_url")) updateData.image_url = resolved;
          
          const { error } = await supabaseAdmin
            .from("tools")
            .update(updateData)
            .eq("id", tool.id);
          if (error) {
            console.error("[triggerBackgroundResolution] DB Update failed:", error.message);
          }
        }
      } catch (err: any) {
        console.error("[triggerBackgroundResolution] Resolution failed:", err);
      }
    })();
  }
}

export const ToolModel = {
  async findAll(): Promise<Tool[]> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*");
    if (error) throw new Error(error.message);
    const mapped = (data || []).map(mapRow);

    // Add ratings
    const { data: ratings } = await supabaseAdmin
      .from("rentals")
      .select("tool_id, rating")
      .not("rating", "is", null);
      
    const toolRatings: Record<string, { sum: number; count: number }> = {};
    if (ratings) {
      for (const r of ratings) {
        if (!toolRatings[r.tool_id]) {
          toolRatings[r.tool_id] = { sum: 0, count: 0 };
        }
        toolRatings[r.tool_id].sum += Number(r.rating);
        toolRatings[r.tool_id].count += 1;
      }
    }

    mapped.forEach((t: Tool) => {
      const info = toolRatings[t.id];
      t.rating = info ? Math.round((info.sum / info.count) * 10) / 10 : 0;
      t.rating_count = info ? info.count : 0;
    });

    mapped.forEach(triggerBackgroundResolution);
    return mapped;
  },

  async findById(id: string): Promise<Tool | null> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    const mapped = mapRow(data);
    if (mapped) {
      // Get ratings for this tool
      const { data: ratings } = await supabaseAdmin
        .from("rentals")
        .select("rating")
        .eq("tool_id", id)
        .not("rating", "is", null);
      
      const values = (ratings || []).map((r: any) => Number(r.rating));
      mapped.rating = values.length > 0 ? Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10 : 0;
      mapped.rating_count = values.length;

      triggerBackgroundResolution(mapped);
    }
    return mapped;
  },

  async findByCompany(companyId: string): Promise<Tool[]> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    const mapped = (data || []).map(mapRow);

    // Add ratings
    const { data: ratings } = await supabaseAdmin
      .from("rentals")
      .select("tool_id, rating")
      .eq("company_id", companyId)
      .not("rating", "is", null);
      
    const toolRatings: Record<string, { sum: number; count: number }> = {};
    if (ratings) {
      for (const r of ratings) {
        if (!toolRatings[r.tool_id]) {
          toolRatings[r.tool_id] = { sum: 0, count: 0 };
        }
        toolRatings[r.tool_id].sum += Number(r.rating);
        toolRatings[r.tool_id].count += 1;
      }
    }

    mapped.forEach((t: Tool) => {
      const info = toolRatings[t.id];
      t.rating = info ? Math.round((info.sum / info.count) * 10) / 10 : 0;
      t.rating_count = info ? info.count : 0;
    });

    mapped.forEach(triggerBackgroundResolution);
    return mapped;
  },

  async create(tool: Omit<Tool, "id">): Promise<Tool> {
    const resolvedImage = await resolveImageUrl(tool.image);
    
    // Adapt payload to match the database columns dynamically
    const columns = await getToolColumns();
    const payload: any = { ...tool };
    
    if (columns.includes("image_url")) {
      payload.image_url = resolvedImage;
    }
    if (columns.includes("image")) {
      payload.image = resolvedImage;
    } else {
      delete payload.image;
    }
    if (!columns.includes("images")) {
      delete payload.images;
    }

    const { data, error } = await supabaseAdmin
      .from("tools")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async update(id: string, patch: Partial<Tool>): Promise<Tool> {
    const resolvedImage = patch.image !== undefined ? await resolveImageUrl(patch.image) : undefined;
    
    // Adapt payload to match the database columns dynamically
    const columns = await getToolColumns();
    const payload: any = { ...patch };
    
    if (resolvedImage !== undefined) {
      if (columns.includes("image_url")) {
        payload.image_url = resolvedImage;
      }
      if (columns.includes("image")) {
        payload.image = resolvedImage;
      } else {
        delete payload.image;
      }
    }
    if (!columns.includes("images")) {
      delete payload.images;
    }

    const { data, error } = await supabaseAdmin
      .from("tools")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from("tools").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
