import { supabaseAdmin } from "../config/supabase";

export interface Tool {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category_id: string;
  image: string;
  price_per_day: number;
  available: boolean;
  quantity: number;
}

function mapRow(row: any): Tool {
  if (!row) return row;
  return {
    ...row,
    image: row.image || row.image_url || ""
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
  return ["id", "company_id", "name", "description", "category_id", "image", "price_per_day", "available", "quantity"];
}

async function resolveImageUrl(url: string): Promise<string> {
  if (!url) return url;
  
  let cleanUrl = url.trim();
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  // If already a direct image link, return it
  const isDirectImage = /\.(png|jpe?g|gif|webp|svg)(?:\?.*)?$/i.test(cleanUrl);
  if (isDirectImage) {
    return cleanUrl;
  }

  // Special resolver for Imgur pages and albums using fetch and parsing meta og:image
  if (/imgur\.com/i.test(cleanUrl)) {
    try {
      const response = await fetch(cleanUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
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

  // General resolver for other webpages
  if (/^https?:\/\//i.test(cleanUrl)) {
    try {
      const response = await fetch(cleanUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
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
    if (mapped) triggerBackgroundResolution(mapped);
    return mapped;
  },

  async findByCompany(companyId: string): Promise<Tool[]> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    const mapped = (data || []).map(mapRow);
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
