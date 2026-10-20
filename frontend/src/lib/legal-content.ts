/**
 * Legal pages (privacy, terms, cookies). Italian is the governing text; English
 * is shown for every other interface language.
 *
 * Fields in [square brackets] must be completed by the company before going live
 * (legal name, registered office, VAT number).
 */

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };
type Lang = 'it' | 'en';

const COMPANY_IT = '[Ragione sociale], con sede in [indirizzo completo], P. IVA [numero]';
const COMPANY_EN = '[Company name], registered office at [full address], VAT no. [number]';
const EMAIL = 'hello@roomly.it';

const PROCESSORS_IT = [
  'Supabase Inc. (autenticazione e database)',
  'Vercel Inc. (hosting del sito)',
  'Railway Corp. (hosting del server applicativo)',
  'Cloudflare Inc. (verifica anti-bot Turnstile)',
  'Geoapify GmbH (completamento automatico degli indirizzi negli annunci)',
];
const PROCESSORS_EN = [
  'Supabase Inc. (authentication and database)',
  'Vercel Inc. (website hosting)',
  'Railway Corp. (application server hosting)',
  'Cloudflare Inc. (Turnstile anti-bot check)',
  'Geoapify GmbH (address autocomplete in listings)',
];

const privacy: Record<Lang, LegalDoc> = {
  it: {
    title: 'Informativa sulla privacy',
    updated: 'Ultimo aggiornamento: 20 ottobre 2026',
    intro:
      'Questa informativa spiega quali dati personali tratta Roomly, perché, su quale base giuridica e quali diritti hai, ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") e del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018.',
    sections: [
      {
        title: '1. Titolare del trattamento',
        paragraphs: [
          `Il titolare del trattamento è ${COMPANY_IT}. Per qualsiasi richiesta sulla privacy puoi scrivere a ${EMAIL}.`,
          'Roomly non ha nominato un Responsabile della protezione dei dati (DPO) perché non ricorrono i presupposti dell’art. 37 GDPR.',
        ],
      },
      {
        title: '2. Dati che trattiamo',
        paragraphs: ['Trattiamo solo i dati necessari al servizio:'],
        list: [
          'Dati dell’account: nome, cognome, email, data di nascita (per verificare la maggiore età), password (conservata solo in forma cifrata dal fornitore di autenticazione).',
          'Preferenze di ricerca che scegli di indicare: budget, animali, fumo, abitudini di rumore, ordine, orari e studio.',
          'Annunci pubblicati dai proprietari: titolo, descrizione, prezzo, indirizzo e coordinate dell’immobile, caratteristiche e fotografie.',
          'Richieste e messaggi scambiati tra studenti e proprietari tramite la chat di Roomly.',
          'Dati tecnici: indirizzo IP, tipo di browser e dati di sessione necessari a mantenere l’accesso e a proteggere il servizio da abusi.',
          'Lingua preferita e posizione in lista d’attesa.',
        ],
      },
      {
        title: '3. Finalità e basi giuridiche',
        paragraphs: [],
        list: [
          'Creare e gestire il tuo account, pubblicare annunci, inviare richieste e messaggi: esecuzione del contratto (art. 6.1.b GDPR).',
          'Verificare che gli utenti siano maggiorenni e gestire la lista d’attesa: esecuzione del contratto e misure precontrattuali (art. 6.1.b).',
          'Sicurezza del servizio, prevenzione di frodi, spam e accessi automatizzati: legittimo interesse del titolare (art. 6.1.f).',
          'Adempiere a obblighi di legge e rispondere a richieste delle autorità: obbligo legale (art. 6.1.c).',
          'Inviarti comunicazioni sull’apertura del servizio quando ti iscrivi alla lista d’attesa: esecuzione della tua richiesta; puoi chiedere di non ricevere più comunicazioni in qualsiasi momento.',
        ],
      },
      {
        title: '4. Obbligatorietà del conferimento',
        paragraphs: [
          'I dati dell’account sono necessari per usare Roomly: senza di essi non possiamo creare l’account. Le preferenze di ricerca sono facoltative.',
        ],
      },
      {
        title: '5. Destinatari e responsabili del trattamento',
        paragraphs: [
          'I dati sono trattati da personale autorizzato e da fornitori che agiscono come responsabili del trattamento ai sensi dell’art. 28 GDPR, con contratto che li vincola alla riservatezza e alla sicurezza:',
        ],
        list: PROCESSORS_IT,
      },
      {
        title: '6. Cosa vedono gli altri utenti',
        paragraphs: [
          'Gli annunci sono visibili agli utenti registrati, inclusi nome del proprietario, zona e fotografie. Quando invii una richiesta, il proprietario vede il tuo nome e i messaggi che gli scrivi. L’indirizzo esatto dell’immobile è usato per calcolare la distanza dalle università.',
          'Non vendiamo i tuoi dati personali e non li usiamo per pubblicità profilata.',
        ],
      },
      {
        title: '7. Trasferimenti fuori dallo Spazio economico europeo',
        paragraphs: [
          'Alcuni fornitori hanno sede negli Stati Uniti. In questi casi il trasferimento avviene sulla base della decisione di adeguatezza UE-USA (EU-U.S. Data Privacy Framework) per i fornitori certificati, oppure delle Clausole contrattuali standard approvate dalla Commissione europea (art. 46 GDPR). Puoi chiederne copia scrivendo a ' + EMAIL + '.',
        ],
      },
      {
        title: '8. Per quanto tempo conserviamo i dati',
        paragraphs: [],
        list: [
          'Dati dell’account, annunci, richieste e messaggi: finché l’account è attivo; dopo la cancellazione vengono eliminati entro 30 giorni, salvo quanto necessario per obblighi di legge o per la difesa di un diritto.',
          'Dati della lista d’attesa: fino all’apertura del servizio o finché non chiedi la cancellazione.',
          'Dati tecnici e di sicurezza: per il tempo strettamente necessario, in genere non oltre 12 mesi.',
        ],
      },
      {
        title: '9. I tuoi diritti',
        paragraphs: [
          `In qualsiasi momento puoi esercitare i diritti previsti dagli artt. 15-22 GDPR scrivendo a ${EMAIL}: accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opposizione al trattamento basato sul legittimo interesse. Risponderemo entro un mese.`,
          'Se ritieni che il trattamento violi il GDPR, puoi proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it) o all’autorità del Paese UE in cui risiedi.',
        ],
      },
      {
        title: '10. Minori',
        paragraphs: ['Roomly è riservato ai maggiorenni. Non raccogliamo consapevolmente dati di persone con meno di 18 anni; se ne veniamo a conoscenza, li cancelliamo.'],
      },
      {
        title: '11. Decisioni automatizzate',
        paragraphs: ['Non prendiamo decisioni basate unicamente su trattamenti automatizzati che producano effetti giuridici su di te (art. 22 GDPR). Il calcolo della distanza dalle università serve solo a ordinare i risultati.'],
      },
      {
        title: '12. Sicurezza e modifiche',
        paragraphs: [
          'Adottiamo misure tecniche e organizzative adeguate (connessioni cifrate, cookie di sessione protetti, accesso limitato ai dati). Se modifichiamo questa informativa aggiorneremo la data in alto e, per modifiche rilevanti, te lo comunicheremo.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 20 October 2026',
    intro:
      'This notice explains which personal data Roomly processes, why, on what legal basis and which rights you have, under Articles 13 and 14 of Regulation (EU) 2016/679 ("GDPR") and Italian Legislative Decree 196/2003 as amended. The Italian version prevails.',
    sections: [
      {
        title: '1. Data controller',
        paragraphs: [
          `The controller is ${COMPANY_EN}. For any privacy request write to ${EMAIL}.`,
          'Roomly has not appointed a Data Protection Officer because the conditions of Article 37 GDPR do not apply.',
        ],
      },
      {
        title: '2. Data we process',
        paragraphs: ['We only process the data the service needs:'],
        list: [
          'Account data: first and last name, email, date of birth (to check you are an adult), password (stored only in encrypted form by our authentication provider).',
          'Search preferences you choose to give: budget, pets, smoking, noise, tidiness, schedule and study habits.',
          'Listings published by owners: title, description, price, property address and coordinates, features and photos.',
          'Requests and messages exchanged between students and owners in the Roomly chat.',
          'Technical data: IP address, browser type and session data needed to keep you signed in and protect the service from abuse.',
          'Preferred language and waitlist position.',
        ],
      },
      {
        title: '3. Purposes and legal bases',
        paragraphs: [],
        list: [
          'Creating and running your account, publishing listings, sending requests and messages: performance of a contract (Art. 6(1)(b) GDPR).',
          'Checking that users are adults and managing the waitlist: contract and pre-contractual steps (Art. 6(1)(b)).',
          'Security, preventing fraud, spam and automated access: our legitimate interest (Art. 6(1)(f)).',
          'Complying with legal obligations and requests from authorities: legal obligation (Art. 6(1)(c)).',
          'Telling you when the service opens if you join the waitlist: fulfilling your request; you can opt out at any time.',
        ],
      },
      {
        title: '4. Is providing data mandatory?',
        paragraphs: ['Account data is required to use Roomly; without it we cannot create your account. Search preferences are optional.'],
      },
      {
        title: '5. Recipients and processors',
        paragraphs: ['Data is handled by authorised staff and by providers acting as processors under Article 28 GDPR, bound by contract to confidentiality and security:'],
        list: PROCESSORS_EN,
      },
      {
        title: '6. What other users see',
        paragraphs: [
          'Listings are visible to registered users, including the owner’s name, area and photos. When you send a request, the owner sees your name and your messages. The exact property address is used to calculate the distance to universities.',
          'We do not sell your personal data and do not use it for targeted advertising.',
        ],
      },
      {
        title: '7. Transfers outside the European Economic Area',
        paragraphs: [
          `Some providers are based in the United States. Transfers rely on the EU-U.S. Data Privacy Framework adequacy decision for certified providers, or on the European Commission’s Standard Contractual Clauses (Art. 46 GDPR). You can ask for a copy at ${EMAIL}.`,
        ],
      },
      {
        title: '8. How long we keep data',
        paragraphs: [],
        list: [
          'Account data, listings, requests and messages: while the account is active; deleted within 30 days of account deletion, except what the law requires or what is needed to defend a legal claim.',
          'Waitlist data: until the service opens or until you ask us to delete it.',
          'Technical and security data: only as long as strictly necessary, usually no more than 12 months.',
        ],
      },
      {
        title: '9. Your rights',
        paragraphs: [
          `You can exercise your rights under Articles 15-22 GDPR at any time by writing to ${EMAIL}: access, rectification, erasure, restriction, data portability and objection to processing based on legitimate interest. We reply within one month.`,
          'You can lodge a complaint with the Italian Data Protection Authority (www.garanteprivacy.it) or with the authority of the EU country where you live.',
        ],
      },
      {
        title: '10. Minors',
        paragraphs: ['Roomly is for adults only. We do not knowingly collect data from people under 18; if we find out, we delete it.'],
      },
      {
        title: '11. Automated decisions',
        paragraphs: ['We do not take decisions based solely on automated processing that produce legal effects on you (Art. 22 GDPR). The distance calculation only orders search results.'],
      },
      {
        title: '12. Security and changes',
        paragraphs: [
          'We use appropriate technical and organisational measures (encrypted connections, protected session cookies, restricted access to data). If we change this notice we update the date above and, for significant changes, we let you know.',
        ],
      },
    ],
  },
};

const terms: Record<Lang, LegalDoc> = {
  it: {
    title: 'Termini di servizio',
    updated: 'Ultimo aggiornamento: 20 ottobre 2026',
    intro: `Questi termini regolano l’uso di Roomly, servizio fornito da ${COMPANY_IT}. Registrandoti dichiari di averli letti e accettati.`,
    sections: [
      {
        title: '1. Il servizio',
        paragraphs: [
          'Roomly è una piattaforma online che mette in contatto studenti in cerca di una stanza e proprietari che pubblicano annunci. Roomly non è un’agenzia immobiliare, non è parte dei contratti di locazione tra gli utenti e non incassa canoni o depositi.',
          'Durante la fase beta il servizio è gratuito. Eventuali costi futuri saranno comunicati prima di essere applicati e richiederanno la tua accettazione.',
        ],
      },
      {
        title: '2. Account',
        paragraphs: [
          'Per usare Roomly devi avere almeno 18 anni e fornire dati veri e aggiornati. Sei responsabile della riservatezza delle tue credenziali e delle attività svolte con il tuo account. Un account è personale e non cedibile.',
        ],
      },
      {
        title: '3. Regole per i proprietari',
        paragraphs: ['Possono pubblicare annunci solo gli account approvati da Roomly come proprietari. Pubblicando un annuncio dichiari che:'],
        list: [
          'hai il diritto di affittare l’immobile o sei autorizzato da chi ne ha il diritto;',
          'descrizione, prezzo, spese incluse, fotografie e indirizzo sono veritieri e aggiornati;',
          'rispetterai la normativa sulle locazioni, inclusi registrazione del contratto, obblighi fiscali e divieto di discriminazione;',
          'aggiornerai o rimuoverai l’annuncio quando la stanza non è più disponibile.',
        ],
      },
      {
        title: '4. Regole per gli studenti',
        paragraphs: [
          'Le richieste e i messaggi devono essere pertinenti e rispettosi. Prima di versare denaro o firmare un contratto verifica l’immobile e il proprietario: Roomly non richiede mai pagamenti fuori dalla piattaforma a nome dei proprietari.',
        ],
      },
      {
        title: '5. Contenuti vietati',
        paragraphs: ['Non è consentito pubblicare o inviare:'],
        list: [
          'annunci falsi, ingannevoli o relativi a immobili inesistenti;',
          'contenuti illegali, discriminatori, offensivi o che violano diritti di terzi;',
          'dati personali di altre persone senza il loro consenso;',
          'spam, pubblicità non richiesta o richieste di pagamento fraudolente.',
        ],
      },
      {
        title: '6. Segnalazioni e moderazione',
        paragraphs: [
          `Ai sensi del Regolamento (UE) 2022/2065 (Digital Services Act) puoi segnalare contenuti illegali o contrari a questi termini scrivendo a ${EMAIL}, indicando il contenuto e il motivo. Esaminiamo le segnalazioni in modo tempestivo e motivato.`,
          'Possiamo rimuovere contenuti o sospendere account che violano questi termini; ti comunicheremo la decisione e le ragioni, e potrai contestarla rispondendo alla stessa email.',
        ],
      },
      {
        title: '7. Responsabilità',
        paragraphs: [
          'Roomly fornisce la piattaforma ma non verifica ogni dettaglio degli annunci e non risponde degli accordi presi tra gli utenti. Nei limiti consentiti dalla legge, Roomly non è responsabile per danni derivanti da contenuti pubblicati dagli utenti.',
          'Nulla in questi termini limita i diritti che ti spettano come consumatore ai sensi del D.Lgs. 206/2005 (Codice del Consumo) né la responsabilità per dolo o colpa grave.',
        ],
      },
      {
        title: '8. Proprietà intellettuale',
        paragraphs: [
          'Marchio, logo, grafica e software di Roomly sono protetti. Pubblicando fotografie e testi mantieni i tuoi diritti e concedi a Roomly una licenza non esclusiva e gratuita a mostrarli sulla piattaforma per la durata dell’annuncio.',
        ],
      },
      {
        title: '9. Cancellazione dell’account',
        paragraphs: [`Puoi chiedere la cancellazione del tuo account in qualsiasi momento scrivendo a ${EMAIL}. I dati verranno trattati come descritto nell’informativa sulla privacy.`],
      },
      {
        title: '10. Modifiche',
        paragraphs: ['Possiamo aggiornare questi termini. Le modifiche rilevanti ti saranno comunicate con almeno 15 giorni di anticipo; se non le accetti puoi cancellare l’account.'],
      },
      {
        title: '11. Legge applicabile e foro',
        paragraphs: [
          'Questi termini sono regolati dalla legge italiana. Se sei un consumatore è competente il foro del tuo luogo di residenza o domicilio, e conservi la protezione delle norme inderogabili del tuo Paese di residenza nell’UE. Puoi inoltre ricorrere agli organismi di risoluzione alternativa delle controversie (ADR) previsti dal Codice del Consumo.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: 20 October 2026',
    intro: `These terms govern the use of Roomly, provided by ${COMPANY_EN}. By signing up you confirm you have read and accepted them. The Italian version prevails.`,
    sections: [
      {
        title: '1. The service',
        paragraphs: [
          'Roomly is an online platform that connects students looking for a room with owners who publish listings. Roomly is not a real-estate agency, is not a party to rental contracts between users and does not collect rent or deposits.',
          'During the beta the service is free. Any future fees will be announced before they apply and will require your acceptance.',
        ],
      },
      {
        title: '2. Accounts',
        paragraphs: ['You must be at least 18 and provide true, up-to-date information. You are responsible for keeping your credentials confidential and for activity on your account. Accounts are personal and not transferable.'],
      },
      {
        title: '3. Rules for owners',
        paragraphs: ['Only accounts Roomly has approved as owners can publish listings. By publishing a listing you confirm that:'],
        list: [
          'you have the right to rent the property or are authorised by whoever does;',
          'description, price, included bills, photos and address are true and up to date;',
          'you will comply with rental law, including contract registration, tax obligations and the ban on discrimination;',
          'you will update or remove the listing when the room is no longer available.',
        ],
      },
      {
        title: '4. Rules for students',
        paragraphs: ['Requests and messages must be relevant and respectful. Check the property and the owner before paying money or signing a contract: Roomly never asks for payments outside the platform on behalf of owners.'],
      },
      {
        title: '5. Prohibited content',
        paragraphs: ['You may not publish or send:'],
        list: [
          'fake or misleading listings, or listings for properties that do not exist;',
          'illegal, discriminatory or offensive content, or content that infringes the rights of others;',
          'other people’s personal data without their consent;',
          'spam, unsolicited advertising or fraudulent payment requests.',
        ],
      },
      {
        title: '6. Reports and moderation',
        paragraphs: [
          `Under Regulation (EU) 2022/2065 (Digital Services Act) you can report illegal content or content that breaks these terms by writing to ${EMAIL}, stating the content and the reason. We handle reports promptly and give reasons for our decisions.`,
          'We may remove content or suspend accounts that break these terms; we will tell you the decision and the reasons, and you can contest it by replying to the same email.',
        ],
      },
      {
        title: '7. Liability',
        paragraphs: [
          'Roomly provides the platform but does not check every detail of listings and is not liable for agreements between users. To the extent permitted by law, Roomly is not liable for damage arising from content published by users.',
          'Nothing in these terms limits your rights as a consumer under Italian Legislative Decree 206/2005 (Consumer Code) or liability for wilful misconduct or gross negligence.',
        ],
      },
      {
        title: '8. Intellectual property',
        paragraphs: ['Roomly’s brand, logo, design and software are protected. When you publish photos and text you keep your rights and grant Roomly a free, non-exclusive licence to show them on the platform for as long as the listing is online.'],
      },
      {
        title: '9. Deleting your account',
        paragraphs: [`You can ask us to delete your account at any time by writing to ${EMAIL}. Your data is then handled as described in the privacy policy.`],
      },
      {
        title: '10. Changes',
        paragraphs: ['We may update these terms. Significant changes are announced at least 15 days in advance; if you do not accept them you can delete your account.'],
      },
      {
        title: '11. Governing law and jurisdiction',
        paragraphs: [
          'These terms are governed by Italian law. If you are a consumer, the courts of your place of residence have jurisdiction, and you keep the protection of the mandatory rules of your EU country of residence. You can also use the alternative dispute resolution (ADR) bodies provided for by the Consumer Code.',
        ],
      },
    ],
  },
};

const cookies: Record<Lang, LegalDoc> = {
  it: {
    title: 'Cookie policy',
    updated: 'Ultimo aggiornamento: 20 ottobre 2026',
    intro:
      'Questa pagina spiega quali cookie e strumenti simili usa Roomly, ai sensi dell’art. 122 del D.Lgs. 196/2003, della Direttiva 2002/58/CE (ePrivacy) e delle Linee guida del Garante privacy del 10 giugno 2021.',
    sections: [
      {
        title: '1. Cosa sono i cookie',
        paragraphs: ['I cookie sono piccoli file che il sito salva sul tuo dispositivo. Strumenti simili, come il local storage del browser, funzionano in modo analogo e sono trattati allo stesso modo.'],
      },
      {
        title: '2. Cookie tecnici che usiamo',
        paragraphs: ['Roomly usa solo cookie e strumenti tecnici, necessari a far funzionare il servizio che hai richiesto:'],
        list: [
          'sb-token: mantiene l’accesso al tuo account. Prima parte, HttpOnly, durata 7 giorni.',
          'sb-refresh-token: rinnova l’accesso senza chiederti di nuovo la password. Prima parte, HttpOnly, durata 30 giorni.',
          'Local storage (roomly.account, roomly.lastKnownRole, roomly-language): ricorda lingua e ruolo per caricare le pagine più velocemente. Resta finché non esci o cancelli i dati del browser.',
          'Cloudflare Turnstile: durante accesso e registrazione verifica che tu non sia un bot; può impostare cookie tecnici di sicurezza.',
        ],
      },
      {
        title: '3. Niente profilazione né statistiche di terze parti',
        paragraphs: [
          'Non usiamo cookie di profilazione, pubblicitari o di statistica di terze parti. Per questo, secondo le linee guida del Garante, non è necessario il tuo consenso e non mostriamo un banner cookie.',
          'Alcune immagini dimostrative sono caricate da Unsplash: per mostrarle il loro server riceve l’indirizzo IP del tuo dispositivo, senza impostare cookie di profilazione.',
        ],
      },
      {
        title: '4. Come gestirli',
        paragraphs: [
          'Puoi cancellare o bloccare i cookie dalle impostazioni del browser. Se blocchi i cookie tecnici non potrai accedere al tuo account.',
          'Se in futuro introdurremo cookie non tecnici, aggiorneremo questa pagina e ti chiederemo prima il consenso, con la possibilità di rifiutare con la stessa facilità.',
        ],
      },
      {
        title: '5. Contatti',
        paragraphs: [`Per domande su questa pagina scrivi a ${EMAIL}. Le informazioni sul trattamento dei dati sono nell’informativa sulla privacy.`],
      },
    ],
  },
  en: {
    title: 'Cookie Policy',
    updated: 'Last updated: 20 October 2026',
    intro:
      'This page explains which cookies and similar tools Roomly uses, under Article 122 of Italian Legislative Decree 196/2003, Directive 2002/58/EC (ePrivacy) and the Italian Data Protection Authority’s guidelines of 10 June 2021. The Italian version prevails.',
    sections: [
      {
        title: '1. What cookies are',
        paragraphs: ['Cookies are small files a website stores on your device. Similar tools, such as the browser’s local storage, work the same way and are treated the same way.'],
      },
      {
        title: '2. Technical cookies we use',
        paragraphs: ['Roomly only uses technical cookies and tools needed to run the service you asked for:'],
        list: [
          'sb-token: keeps you signed in. First-party, HttpOnly, lasts 7 days.',
          'sb-refresh-token: renews your session without asking for your password again. First-party, HttpOnly, lasts 30 days.',
          'Local storage (roomly.account, roomly.lastKnownRole, roomly-language): remembers your language and role so pages load faster. Kept until you sign out or clear browser data.',
          'Cloudflare Turnstile: checks you are not a bot during sign-in and sign-up; it may set technical security cookies.',
        ],
      },
      {
        title: '3. No profiling or third-party analytics',
        paragraphs: [
          'We do not use profiling, advertising or third-party analytics cookies. Under the Authority’s guidelines your consent is therefore not required and we do not show a cookie banner.',
          'Some sample images are loaded from Unsplash: their server receives your device’s IP address to display them, without setting profiling cookies.',
        ],
      },
      {
        title: '4. Managing cookies',
        paragraphs: [
          'You can delete or block cookies in your browser settings. If you block technical cookies you will not be able to sign in.',
          'If we ever introduce non-technical cookies, we will update this page and ask for your consent first, with refusing as easy as accepting.',
        ],
      },
      {
        title: '5. Contact',
        paragraphs: [`For questions about this page write to ${EMAIL}. Information on how we process data is in the privacy policy.`],
      },
    ],
  },
};

const DOCS = { privacy, terms, cookies } as const;

/** The legal document in the interface language: Italian for Italian, English otherwise. */
export function getLegalDoc(kind: keyof typeof DOCS, language: string): LegalDoc {
  return DOCS[kind][language === 'it' ? 'it' : 'en'];
}
