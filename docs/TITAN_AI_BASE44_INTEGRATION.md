# Titan AI Base44 Integration

Titan AI already runs on the TitanOS Vercel API. Base44 should integrate with the existing HTTPS endpoints instead of trying to revive the old Base44 runtime.

## Endpoints

- `GET /api/functions/titanAICapabilities`
  - Returns the machine-readable Titan AI contract, supported actions, and workflow IDs.
- `POST /api/functions/titanAI`
  - Main Titan AI chat endpoint.
- `POST /api/functions/aiExecuteAction`
  - Direct action endpoint for confirmed Titan AI office actions.

## Auth

Use a Supabase access token in the Authorization header:

```http
Authorization: Bearer <supabase_access_token>
```

Titan AI does not accept unauthenticated chat or write actions.

## CORS for Base44

If Base44 calls Titan AI from a browser origin, add that origin to the Vercel environment variable below:

```env
CORS_ALLOWED_ORIGINS=https://your-base44-app.example
```

Notes:

- Multiple origins can be comma-separated.
- Server-to-server calls do not need browser origin allowlisting.
- The shared CORS layer will not reflect arbitrary origins.

## Recommended Base44 flow

1. Sign the user into TitanOS through Supabase.
2. Read `GET /api/functions/titanAICapabilities` once at startup to discover supported intents.
3. Send chat prompts to `POST /api/functions/titanAI`.
4. If Titan AI returns `type: "confirm"`, either:
   - show a confirmation UI and send the confirmed action back to `POST /api/functions/titanAI`, or
   - call `POST /api/functions/aiExecuteAction` directly.

## Example request

```http
POST /api/functions/titanAI
Content-Type: application/json
Authorization: Bearer <supabase_access_token>

{
  "messages": [
    {
      "role": "user",
      "content": "Who owes money right now?"
    }
  ],
  "pageContext": {
    "path": "/assistant",
    "title": "Titan AI",
    "domain": "ai",
    "workflow": "office"
  },
  "lawMastermind": false,
  "ownerAutopilot": false,
  "guardrails": {
    "killSwitch": false
  }
}
```

## Example direct action

```http
POST /api/functions/aiExecuteAction
Content-Type: application/json
Authorization: Bearer <supabase_access_token>

{
  "intent": "create_invoice",
  "params": {
    "customer_name": "Acme Service Co",
    "total": 185
  }
}
```

## Supported write intents

- `schedule_job`
- `create_job`
- `create_estimate`
- `create_invoice`
- `send_invoice`
- `create_customer`
- `record_expense`

## TitanOS data boundary

Titan AI responses about jobs, invoices, customers, and money are grounded in server-owned Supabase snapshots. Do not send TitanOS business data from Base44 and treat it as live truth; the server already loads owned data for the authenticated user.