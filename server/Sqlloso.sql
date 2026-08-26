-- ============================================================
-- ROOMLY DATABASE
-- MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS roomly
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE roomly;


-- ============================================================
-- 1. UTENTI
-- ============================================================

CREATE TABLE utenti (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,
    nome_utente VARCHAR(50) UNIQUE,

    telefono VARCHAR(30),

    password_hash VARCHAR(255) NOT NULL,

    data_nascita DATE,

    genere VARCHAR(50),
    nazionalita VARCHAR(80),

    foto_profilo VARCHAR(500),
    bio TEXT,

    stato ENUM(
        'attivo',
        'sospeso',
        'eliminato'
    ) NOT NULL DEFAULT 'attivo',

    ultimo_accesso DATETIME,

    email_verificata BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_utenti_email (email),
    INDEX idx_utenti_username (nome_utente),
    INDEX idx_utenti_stato (stato)
);


-- ============================================================
-- 2. PREFERENZE UTENTI
-- ============================================================

CREATE TABLE preferenze_utenti (
    utente_id BIGINT UNSIGNED PRIMARY KEY,

    budget_min DECIMAL(12,2),
    budget_max DECIMAL(12,2),

    data_ingresso DATE,

    durata_mesi SMALLINT UNSIGNED,

    persone INT UNSIGNED NOT NULL DEFAULT 1,

    genere_preferito VARCHAR(50),

    animali BOOLEAN,
    fumatori BOOLEAN,
    studenti BOOLEAN,

    preferenze TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_budget
        CHECK (
            budget_min IS NULL
            OR budget_max IS NULL
            OR budget_min <= budget_max
        ),

    CONSTRAINT chk_persone
        CHECK (persone >= 1),

    CONSTRAINT chk_durata
        CHECK (
            durata_mesi IS NULL
            OR durata_mesi > 0
        )
);


-- ============================================================
-- 3. QUARTIERI PREFERITI
-- ============================================================

CREATE TABLE preferenze_quartieri (
    utente_id BIGINT UNSIGNED NOT NULL,

    quartiere VARCHAR(150) NOT NULL,

    PRIMARY KEY (utente_id, quartiere),

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    INDEX idx_quartiere (quartiere)
);


-- ============================================================
-- 4. STANZE / IMMOBILI
-- ============================================================

CREATE TABLE stanze (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    proprietario_id BIGINT UNSIGNED NOT NULL,

    titolo VARCHAR(200) NOT NULL,
    descrizione TEXT,

    tipo ENUM(
        'stanza_singola',
        'stanza_doppia',
        'monolocale',
        'appartamento_condiviso',
        'appartamento'
    ) NOT NULL,

    stato ENUM(
        'disponibile',
        'prenotata',
        'affittata',
        'venduta',
        'sospesa'
    ) NOT NULL DEFAULT 'disponibile',

    prezzo DECIMAL(12,2) NOT NULL,
    cauzione DECIMAL(12,2),
    spese_mensili DECIMAL(12,2),

    commissione DECIMAL(12,2),

    prezzo_trattabile BOOLEAN NOT NULL DEFAULT FALSE,

    -- --------------------------------------------------------
    -- Posizione
    -- --------------------------------------------------------

    indirizzo VARCHAR(255) NOT NULL,
    civico VARCHAR(20),

    quartiere VARCHAR(150),

    citta VARCHAR(100) NOT NULL,
    provincia VARCHAR(100),
    regione VARCHAR(100),
    cap VARCHAR(10),

    latitudine DECIMAL(10,8),
    longitudine DECIMAL(11,8),

    -- --------------------------------------------------------
    -- Dimensioni
    -- --------------------------------------------------------

    superficie_mq DECIMAL(8,2),

    piano SMALLINT,

    ascensore BOOLEAN,

    camere INT UNSIGNED,
    bagni INT UNSIGNED,
    posti_letto INT UNSIGNED,

    coinquilini_attuali INT UNSIGNED,

    -- --------------------------------------------------------
    -- Arredamento
    -- --------------------------------------------------------

    proprieta_arredata BOOLEAN NOT NULL DEFAULT FALSE,

    -- --------------------------------------------------------
    -- Spazi comuni
    -- --------------------------------------------------------

    cucina_condivisa BOOLEAN,
    soggiorno_condiviso BOOLEAN,

    balcone BOOLEAN,
    terrazzo BOOLEAN,
    giardino BOOLEAN,

    parcheggio BOOLEAN,
    cantina BOOLEAN,

    -- --------------------------------------------------------
    -- Servizi
    -- --------------------------------------------------------

    riscaldamento VARCHAR(100),

    aria_condizionata BOOLEAN,
    lavatrice BOOLEAN,
    lavastoviglie BOOLEAN,

    internet BOOLEAN,
    utenze_incluse BOOLEAN,

    accesso_disabili BOOLEAN,

    -- --------------------------------------------------------
    -- Regole
    -- --------------------------------------------------------

    animali_consentiti BOOLEAN,
    fumatori_consentiti BOOLEAN,

    regole_casa TEXT,

    contratto_tipo VARCHAR(100),

    -- --------------------------------------------------------
    -- Pubblicazione
    -- --------------------------------------------------------

    data_pubblicazione DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    visualizzazioni INT UNSIGNED NOT NULL DEFAULT 0,

    attiva BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (proprietario_id)
        REFERENCES utenti(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_prezzo
        CHECK (prezzo >= 0),

    CONSTRAINT chk_cauzione
        CHECK (
            cauzione IS NULL
            OR cauzione >= 0
        ),

    CONSTRAINT chk_spese
        CHECK (
            spese_mensili IS NULL
            OR spese_mensili >= 0
        ),

    CONSTRAINT chk_superficie
        CHECK (
            superficie_mq IS NULL
            OR superficie_mq > 0
        ),

    CONSTRAINT chk_latitudine
        CHECK (
            latitudine IS NULL
            OR latitudine BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_longitudine
        CHECK (
            longitudine IS NULL
            OR longitudine BETWEEN -180 AND 180
        ),

    INDEX idx_stanze_proprietario (proprietario_id),
    INDEX idx_stanze_citta (citta),
    INDEX idx_stanze_quartiere (quartiere),
    INDEX idx_stanze_stato (stato),
    INDEX idx_stanze_prezzo (prezzo),
    INDEX idx_stanze_tipo (tipo),
    INDEX idx_stanze_attiva (attiva),
    INDEX idx_stanze_data_pubblicazione (data_pubblicazione)
);


-- ============================================================
-- 5. FOTO STANZE
-- ============================================================

CREATE TABLE stanze_foto (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED NOT NULL,

    url VARCHAR(500) NOT NULL,
    didascalia VARCHAR(255),

    copertina BOOLEAN NOT NULL DEFAULT FALSE,

    ordine INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE CASCADE,

    INDEX idx_foto_stanza (stanza_id),
    INDEX idx_foto_copertina (stanza_id, copertina)
);


-- ============================================================
-- 6. PREFERITI
-- ============================================================

CREATE TABLE preferiti (
    utente_id BIGINT UNSIGNED NOT NULL,
    stanza_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (utente_id, stanza_id),

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE CASCADE,

    INDEX idx_preferiti_stanza (stanza_id)
);


-- ============================================================
-- 7. RICHIESTE DI AFFITTO
-- ============================================================

CREATE TABLE richieste_affitto (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED NOT NULL,
    utente_id BIGINT UNSIGNED NOT NULL,

    messaggio TEXT,

    stato ENUM(
        'inviata',
        'visualizzata',
        'accettata',
        'rifiutata',
        'annullata'
    ) NOT NULL DEFAULT 'inviata',

    data_inizio DATE,
    durata_mesi SMALLINT UNSIGNED,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY richiesta_unica (stanza_id, utente_id),

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE CASCADE,

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    INDEX idx_richieste_stanza (stanza_id),
    INDEX idx_richieste_utente (utente_id),
    INDEX idx_richieste_stato (stato)
);


-- ============================================================
-- 8. AFFITTI / CONTRATTI
-- ============================================================

CREATE TABLE affitti (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED NOT NULL,
    affittuario_id BIGINT UNSIGNED NOT NULL,

    richiesta_id BIGINT UNSIGNED,

    data_inizio DATE NOT NULL,
    data_fine DATE,

    prezzo_mensile DECIMAL(12,2) NOT NULL,

    cauzione DECIMAL(12,2),

    stato ENUM(
        'attivo',
        'terminato',
        'annullato'
    ) NOT NULL DEFAULT 'attivo',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (affittuario_id)
        REFERENCES utenti(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (richiesta_id)
        REFERENCES richieste_affitto(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_affitto_prezzo
        CHECK (prezzo_mensile >= 0),

    CONSTRAINT chk_affitto_cauzione
        CHECK (
            cauzione IS NULL
            OR cauzione >= 0
        ),

    CONSTRAINT chk_date_affitto
        CHECK (
            data_fine IS NULL
            OR data_fine >= data_inizio
        ),

    INDEX idx_affitti_stanza (stanza_id),
    INDEX idx_affitti_affittuario (affittuario_id),
    INDEX idx_affitti_stato (stato),
    INDEX idx_affitti_date (data_inizio, data_fine)
);


-- ============================================================
-- 9. RECENSIONI
-- ============================================================

CREATE TABLE recensioni (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED NOT NULL,
    autore_id BIGINT UNSIGNED NOT NULL,

    affitto_id BIGINT UNSIGNED,

    voto TINYINT UNSIGNED NOT NULL,
    commento TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY recensione_unica (stanza_id, autore_id),

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE CASCADE,

    FOREIGN KEY (autore_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    FOREIGN KEY (affitto_id)
        REFERENCES affitti(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_voto
        CHECK (voto BETWEEN 1 AND 5),

    INDEX idx_recensioni_stanza (stanza_id),
    INDEX idx_recensioni_autore (autore_id)
);


-- ============================================================
-- 10. CONVERSAZIONI
-- ============================================================

CREATE TABLE conversazioni (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE SET NULL,

    INDEX idx_conversazioni_stanza (stanza_id)
);


-- ============================================================
-- 11. PARTECIPANTI CONVERSAZIONI
-- ============================================================

CREATE TABLE conversazioni_utenti (
    conversazione_id BIGINT UNSIGNED NOT NULL,
    utente_id BIGINT UNSIGNED NOT NULL,

    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (conversazione_id, utente_id),

    FOREIGN KEY (conversazione_id)
        REFERENCES conversazioni(id)
        ON DELETE CASCADE,

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE CASCADE,

    INDEX idx_conv_utenti_utente (utente_id)
);


-- ============================================================
-- 12. MESSAGGI
-- ============================================================

CREATE TABLE messaggi (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    conversazione_id BIGINT UNSIGNED NOT NULL,

    mittente_id BIGINT UNSIGNED NOT NULL,

    testo TEXT NOT NULL,

    letto BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversazione_id)
        REFERENCES conversazioni(id)
        ON DELETE CASCADE,

    FOREIGN KEY (mittente_id)
        REFERENCES utenti(id)
        ON DELETE RESTRICT,

    INDEX idx_messaggi_conversazione (conversazione_id),
    INDEX idx_messaggi_mittente (mittente_id),
    INDEX idx_messaggi_letto (letto),
    INDEX idx_messaggi_data (created_at)
);


-- ============================================================
-- 13. VISUALIZZAZIONI
-- ============================================================

CREATE TABLE visualizzazioni_stanze (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    stanza_id BIGINT UNSIGNED NOT NULL,

    utente_id BIGINT UNSIGNED,

    session_id VARCHAR(255),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (stanza_id)
        REFERENCES stanze(id)
        ON DELETE CASCADE,

    FOREIGN KEY (utente_id)
        REFERENCES utenti(id)
        ON DELETE SET NULL,

    INDEX idx_visualizzazioni_stanza (stanza_id),
    INDEX idx_visualizzazioni_utente (utente_id),
    INDEX idx_visualizzazioni_data (created_at)
);


-- ============================================================
-- FINE SCHEMA
-- ============================================================