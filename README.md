# LLM + Firestore API

## Run local
1) `cp .env.sample .env` y completar variables
2) `npm i`
3) `npm run dev`

## Auth Firestore
Configurar `GOOGLE_APPLICATION_CREDENTIALS` apuntando al JSON de service account. Para emulador, setear `FIRESTORE_EMULATOR_HOST=localhost:8080`.

## Request
POST /chat
{
  "messages": [
    {"role":"system","content":"You are a helpful assistant."},
    {"role":"user","content":"Find the last 5 invoices over 1000 USD"}
  ]
}

El modelo decidirá si llama a:
- `firestore_getDoc({ path })`
- `firestore_query({ collectionPath, where, limit, orderBy })`

## Deploy
Docker:
- `docker build -t llm-firestore-api .`
- `docker run -p 8080:8080 --env-file .env -v $PWD/service-account.json:/workspace/service-account.json llm-firestore-api`

Cloud Run:
- Construir e implementar imagen. Establecer variables de entorno y montar credenciales con Secret Manager.
