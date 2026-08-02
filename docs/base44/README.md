# Base44 Titan Client

Use this module inside your Base44 app to call TitanOS production APIs.

## File

- `docs/base44/titanClient.js`

Copy this file into your Base44 project (suggested path: `src/lib/titanClient.js`).

## Requirements

- Use a valid TitanOS Supabase access token in `supabaseAccessToken`.
- If calling from a browser, add your Base44 origin to `CORS_ALLOWED_ORIGINS` in Vercel.

## Example

```js
import {
  getTitanCapabilities,
  chatTitanAI,
  executeTitanAction,
  mapTitanResponse,
} from "@/lib/titanClient";

const capabilities = await getTitanCapabilities();
console.log(capabilities);

const result = await chatTitanAI({
  supabaseAccessToken,
  messages: [{ role: "user", content: "Who owes money right now?" }],
});

const mapped = mapTitanResponse(result);
console.log(mapped);

if (mapped.kind === "confirm") {
  const done = await executeTitanAction({
    supabaseAccessToken,
    intent: mapped.intent,
    params: mapped.params,
  });
  console.log(done);
}
```
