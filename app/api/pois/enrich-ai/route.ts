import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      ? `situé aux coordonnées ${latitude.toFixed(4)}, ${longitude.toFixed(4)} en France`
      : 'en France';
    
    const categoryContext = subcategory 
      ? `(catégorie: ${category}, sous-catégorie: ${subcategory})`
      : category 
        ? `(catégorie: ${category})`
        : '';

    const existingContext = existingDescription 
      ? `\n\nDescription existante (à améliorer ou remplacer si incorrecte): "${existingDescription}"`
      : '';

    const prompt = `Tu es un guide touristique expert de la France, passionné par les lieux insolites et les histoires locales.

Génère une description captivante pour ce lieu : "${name}" ${categoryContext}, ${locationContext}.${existingContext}

RÈGLES IMPORTANTES:
1. La description doit faire 2-4 phrases maximum (80-150 mots)
2. Commence directement par le contenu, pas par "Ce lieu..." ou "Situé..."
3. Inclus UN fait intéressant, anecdote historique ou détail insolite si possible
4. Utilise un ton chaleureux et engageant, comme un ami local qui partage un bon plan
5. Si c'est un restaurant/café, mentionne l'ambiance ou une spécialité si tu la connais
6. Si tu ne connais pas ce lieu spécifique, génère une description plausible basée sur le nom et la catégorie
7. Écris en français

EXEMPLES DE BON STYLE:
- "Ancienne gare reconvertie en café-librairie, ce lieu atypique mêle odeur de vieux livres et arôme de café torréfié. Les habitués viennent ici pour le fameux chocolat chaud 'du chef de gare', recette secrète depuis 1952."
- "Un lavoir du XIXe siècle remarquablement préservé où les anciens du village racontent encore les histoires qui s'échangeaient pendant les lavées. La charpente en châtaignier est d'origine."

Réponds UNIQUEMENT avec la description, sans guillemets ni préambule.`;

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
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Groq API error:', error);
      return NextResponse.json({ error: error.error?.message || 'Groq API error' }, { status: 500 });
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();

    if (!description) {
      return NextResponse.json({ error: 'No description generated' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      description,
    });

  } catch (error) {
    console.error('Error generating AI description:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI description' },
      { status: 500 }
    );
  }
}
