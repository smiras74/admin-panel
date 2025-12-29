import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const { name, category, subcategory, latitude, longitude, existingDescription } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    // Build context
    const locationContext = latitude && longitude 
      ? `situé aux coordonnées ${latitude.toFixed(6)}, ${longitude.toFixed(6)} en France`
      : 'en France';
    
    const categoryContext = subcategory 
      ? `(catégorie: ${category}, sous-catégorie: ${subcategory})`
      : category 
        ? `(catégorie: ${category})`
        : '';

    const existingContext = existingDescription 
      ? `\n\nDescription existante (à améliorer ou remplacer si incorrecte): "${existingDescription}"`
      : '';

    const prompt = `Tu es un guide touristique expert de la France.

Recherche et décris ce lieu : "${name}" ${categoryContext}, ${locationContext}.${existingContext}

INSTRUCTIONS:
1. Écris une description factuelle et utile de 2-4 phrases (80-150 mots)
2. Mentionne ce qui rend ce lieu intéressant ou unique
3. Si c'est un restaurant/café/commerce, décris le type de cuisine ou les spécialités
4. Indique les horaires d'ouverture si tu les connais
5. Sois précis et informatif, pas de formules vagues
6. Écris en français

FORMAT DE RÉPONSE (respecte exactement ce format):
DESCRIPTION: [ta description ici]
HORAIRES: [horaires d'ouverture ou "Non disponibles" si inconnus]

Exemple de bonne réponse:
DESCRIPTION: Restaurant traditionnel français proposant une cuisine du terroir avec des produits locaux. La carte change selon les saisons et met en avant les spécialités régionales. Terrasse agréable aux beaux jours.
HORAIRES: Mar-Sam 12h-14h et 19h-22h, fermé dimanche et lundi`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Groq API error:', error);
      return NextResponse.json({ error: error.error?.message || 'Groq API error' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: 'No description generated' }, { status: 500 });
    }

    // Parse response
    let description = content;
    let openingHours = '';

    // Try to extract structured data
    const descMatch = content.match(/DESCRIPTION:\s*(.+?)(?=HORAIRES:|$)/s);
    const hoursMatch = content.match(/HORAIRES:\s*(.+?)$/s);

    if (descMatch) {
      description = descMatch[1].trim();
    }
    if (hoursMatch) {
      const hours = hoursMatch[1].trim();
      if (hours.toLowerCase() !== 'non disponibles' && hours.toLowerCase() !== 'non disponible') {
        openingHours = hours;
      }
    }

    return NextResponse.json({
      success: true,
      description,
      openingHours: openingHours || null,
    });

  } catch (error) {
    console.error('Error generating AI description:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI description' },
      { status: 500 }
    );
  }
}
