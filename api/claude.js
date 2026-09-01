// Questo file gira SOLO sul server di Vercel, mai nel browser dell'utente.
// La chiave API resta qui, nascosta: il sito pubblico non la vede mai.
//
// Come funziona: il sito (index.html) manda qui { system, userText },
// questa funzione la gira a Claude aggiungendo la chiave segreta, e
// rimanda indietro la risposta cosi com'e.
//
// Il try/catch avvolge TUTTA la funzione: qualsiasi errore imprevisto
// torna sempre come JSON, mai come pagina di errore HTML di Vercel
// (che altrimenti manderebbe in crash il parsing lato sito).

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Metodo non permesso' });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'ANTHROPIC_API_KEY non configurata su Vercel. Vai su Project Settings > Environment Variables e aggiungila, poi rifai il deploy.'
      });
      return;
    }

    // req.body e' di solito gia' un oggetto (Vercel lo fa in automatico),
    // ma se per qualche motivo arriva come stringa lo interpretiamo comunque.
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { system, userText } = body || {};

    if (!userText) {
      res.status(400).json({ error: 'Richiesta incompleta: manca userText.' });
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        // Modello economico: adatto a JSON strutturati + ricerca web.
        // Per risposte di qualita superiore (a costo maggiore) puoi
        // cambiare questa riga in "claude-sonnet-5".
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: system || undefined,
        messages: [{ role: 'user', content: userText }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const message = (data && data.error && data.error.message) || 'Errore dal server di Anthropic.';
      res.status(response.status).json({ error: message });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Errore nella funzione /api/claude:', err);
    // Qualsiasi errore imprevisto (rete, parsing, timeout gestito, ecc.)
    // torna comunque come JSON leggibile dal sito, mai come pagina HTML.
    res.status(500).json({ error: 'Errore interno del server: ' + (err && err.message ? err.message : 'sconosciuto') });
  }
};
