# AlugaTools
AlugaTools

## App Android

O app (`frontend/`, Expo / React Native) é compilado pelo GitHub Actions no workflow
[`.github/workflows/android.yml`](.github/workflows/android.yml), sem EAS e sem conta Expo:
o `expo prebuild` gera o projeto nativo e o Gradle compila o APK/AAB no runner do GitHub.

### Baixar o APK

- **Cada push** que altera `frontend/` gera um APK. Abra a aba **Actions → Android →** a execução
  desejada e baixe o arquivo em **Artifacts** (vem em um `.zip`).
- **Versões oficiais**: crie e envie uma tag `v*` — o APK (e o AAB, se a chave de release estiver
  configurada) é publicado automaticamente em **Releases**:

  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```

- Também dá para rodar manualmente em **Actions → Android → Run workflow**.

### Assinatura (necessária para a Google Play)

Sem configuração, o APK sai assinado com a chave de **debug** (serve para instalar e testar, mas a
Google Play não aceita). Para builds de release:

1. Gere a chave de upload **uma única vez** e guarde o arquivo e as senhas em local seguro
   (sem ela não é possível publicar atualizações do app):

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore alugatools-upload.keystore \
     -alias alugatools -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 alugatools-upload.keystore > keystore.b64   # macOS: base64 -i alugatools-upload.keystore -o keystore.b64
   ```

2. Em **Settings → Secrets and variables → Actions → Secrets**, crie:

   | Secret | Valor |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | conteúdo de `keystore.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
   | `ANDROID_KEY_ALIAS` | alias da chave (no exemplo: `alugatools`) |
   | `ANDROID_KEY_PASSWORD` | senha da chave (opcional; no formato PKCS12 é a mesma do keystore) |

   O base64 precisa entrar **inteiro** (uma linha só, sem cortes). Copiar do terminal costuma
   perder pedaços; prefira enviar direto do arquivo:

   ```bash
   gh secret set ANDROID_KEYSTORE_BASE64 --repo RenanMor/AlugaTools < keystore.b64
   # Windows (PowerShell): copia o base64 do arquivo para a área de transferência
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("alugatools-upload.keystore")) | Set-Clipboard
   ```

   Para conferir: `wc -c < keystore.b64` deve bater com o número de caracteres que o workflow
   mostra quando o keystore não abre.

Com os secrets configurados, o workflow assina o APK com essa chave e também gera o **AAB**
(`.aab`), que é o formato enviado para a Google Play. O resumo de cada execução mostra o tipo de
assinatura e a impressão digital SHA-256 do certificado.

### Configurações

- **URL da API**: por padrão o app usa `https://alugatools-api.onrender.com`. Para trocar, crie a
  variável `EXPO_PUBLIC_API_BASE_URL` em **Settings → Secrets and variables → Actions → Variables**.
- **Versão**: o `versionName` vem de `version` em `frontend/app.config.ts`; o `versionCode` é o
  número da execução do workflow (sempre crescente, como a Google Play exige).
- **Pacote**: `com.app.ferramentas.marketplace` (definido em `frontend/app.config.ts`). Depois do
  primeiro envio à Google Play ele não pode mais ser alterado.

### Permissões do app

| Permissão | Quando é pedida | Uso |
|---|---|---|
| Notificações | na primeira abertura | avisos de pedidos e entregas |
| Localização (uso em primeiro plano) | na primeira abertura | botão "Usar minha localização" no cadastro de endereço |
| Câmera | ao tirar a primeira foto | fotos da entrega, dos anúncios e da loja |

Em **Perfil → Permissões do app** o usuário vê o status de cada uma e pode permitir depois. Se
tiver negado antes, o botão abre as configurações do Android. As permissões e os textos ficam
em `frontend/app.config.ts`, e a lógica em `frontend/lib/permissions.ts`.

### Build local

Com Android Studio (SDK + JDK 17) instalado:

```bash
cd frontend
npm ci
npx expo run:android            # debug em emulador/dispositivo
npx expo run:android --variant release
```

A pasta `frontend/android/` é gerada pelo `expo prebuild` e não é versionada — mudanças nativas
devem ser feitas em `frontend/app.config.ts` (ou via config plugins).
