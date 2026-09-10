import requests
import sys
import random
import string
import time

SUPABASE_URL = "https://qpcenugubrwrjavryowf.supabase.co"
SUPABASE_KEY = "sb_publishable_7BOkhcWNgVQY_IHwyyLcog_59G__Stn"

URL = f"{SUPABASE_URL}/auth/v1/signup"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Content-Type": "application/json"
}


def random_string(length=8):
    chars = string.ascii_lowercase
    return "".join(random.choice(chars) for _ in range(length))


def create_account(number):
    nome = random_string()
    cognome = random_string()

    # Modifica questo dominio con un indirizzo/dominio di test che controlli
    email = f"roomlytest{number}_{random_string(5)}@example.com"

    password = "TestRoomly123!"

    payload = {
        "email": email,
        "password": password,
        "data": {
            "nome": nome,
            "cognome": cognome,
            "full_name": f"{nome} {cognome}"
        },
        "code_challenge": None,
        "code_challenge_method": None,
        "gotrue_meta_security": {}
    }

    try:
        response = requests.post(
            URL,
            headers=HEADERS,
            json=payload,
            timeout=15
        )

        if response.status_code == 200:
            data = response.json()

            print(f"[{number}] OK")
            print(f"    Email: {email}")
            print(f"    Password: {password}")
            print(f"    ID: {data.get('id')}")
            print()

            return True

        else:
            print(f"[{number}] ERRORE {response.status_code}")
            print(f"    {response.text}")
            print()

            return False

    except requests.RequestException as e:
        print(f"[{number}] ERRORE CONNESSIONE")
        print(f"    {e}")
        print()

        return False


def main():
    if len(sys.argv) != 2:
        print("Uso:")
        print("    python test.py NUMERO_ACCOUNT")
        print()
        print("Esempio:")
        print("    python test.py 10")
        return

    try:
        count = int(sys.argv[1])

        if count < 1:
            raise ValueError

    except ValueError:
        print("Inserisci un numero valido maggiore di 0.")
        return

    print(f"Creazione di {count} account...")
    print("-" * 50)

    success = 0
    failed = 0

    for i in range(1, count + 1):

        if create_account(i):
            success += 1
        else:
            failed += 1

        # Piccola pausa tra le richieste
        time.sleep(0.5)

    print("-" * 50)
    print("COMPLETATO")
    print(f"Creati: {success}")
    print(f"Falliti: {failed}")
    print(f"Totale: {count}")


if __name__ == "__main__":
    main()