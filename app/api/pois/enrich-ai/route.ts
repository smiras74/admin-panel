import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-auth';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { findPoiData } from '@/lib/poi-lookup';

export const dynamic = 'force-dynamic';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function handlePOST(request: NextRequest) {
  try {
    const { id, collection, name, category, subcategory, latitude, longitude, existingDescription } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    // Build context
    const locationContext = latitude && longitude 
      ? `situé aux coordonnées ${latitude.toFixed(4)}, ${longitude.toFixed(4)} en France`
      : 'en France';
    
    const categoryContext = subcategory 
      ? `(catégorie: ${category}, sous-catégorie: ${subcategory})`
      : category 
        ? `(catégorie: ${category})`
        : '';

    // Ground the model in the Wikipedia summary when an article exists
    const { db } = getFirebaseAdmin();
    const poi = await findPoiData(db, id, collection).catch(() => null);
    const wiki = await fetchWikipediaSummary(name, latitude, longitude, poi?.wikidataId || null).catch(() => null);
    const sourceContext = wiki?.extract
      ? `\n\nSOURCE (Wikipédia, "${wiki.title}") — base-toi UNIQUEMENT sur ce texte:\n${wiki.extract}`
      : '';

    const existingContext = existingDescription 
      ? `\n\nDescription existante (à améliorer ou remplacer si incorrecte): "${existingDescription}"`
      : '';

    const prompt = `Tu es un guide touristique expert de la France. Tu rédiges des fiches pour une application où la fiabilité est prioritaire.

Lieu : "${name}" ${categoryContext}, ${locationContext}.${sourceContext}${existingContext}

RÈGLES STRICTES:
1. N'écris QUE des faits dont tu es sûr pour CE lieu précis. N'invente jamais de date, d'anecdote, de recette, de chiffre ou d'histoire.
2. Si tu ne connais pas ce lieu précis, réponds exactement: INCONNU
3. 2 à 4 phrases (60-120 mots), ton chaleureux mais factuel, en français.
4. Commence directement par le contenu (pas "Ce lieu..." ni "Situé...").
5. Ne mentionne pas d'horaires d'ouverture.

Réponds UNIQUEMENT avec la description (ou INCONNU), sans guillemets ni préambule.`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // llama-3.3-70b-versatile was retired by Groq (both AI buttons returned 500)
        model: 'qwen/qwen3.8-27b',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Groq API error:', error);
      return NextResponse.json({ error: error.error?.message || 'Groq API error' }, { status: 500 });
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content || '';
    const description = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (!description || /^INCONNU\b/i.test(description)) {
      return NextResponse.json({ error: 'Lieu inconnu du modèle — aucune description générée (pas d\'invention)' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      description,
      // Opening hours are never generated: an LLM guess is not reliable data
      openingHours: null,
    });

  } catch (error) {
    console.error('Error generating AI description:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI description' },
      { status: 500 }
    );
  }
}

export const POST = withAdmin(handlePOST);
