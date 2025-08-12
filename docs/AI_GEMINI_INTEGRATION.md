# Gemini API Entegrasyonu (v1)
- Base URL: https://generativelanguage.googleapis.com/v1
- Endpoint: /models/{model}:generateContent
- Model: gemini-1.5-flash (fallback: -latest, 1.5-pro)
- Auth: x-goog-api-key header
- Body: contents + generationConfig + optional systemInstruction
