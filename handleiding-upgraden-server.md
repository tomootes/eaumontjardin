# Het grote verhuisplan van de bos-server

*Een handleiding voor Tom en Ruerd, bosnymfen van het eerste uur*
*Op maat gemaakt na een verkenning van `emj-webshop` (winkel.eaumontjardin.fr) op 3 november 2026*

Kijk eens aan, daar staan jullie dan, Tom en Ruerd, onder de oude eik met de pet op en de mouwen al opgestroopt. De oude boom gaan we niet meer verplanten. We zaaien opnieuw, op een nieuw en ruimer stuk grond, en nemen de wortels mee die het waard zijn.

**Doel:** de webshop verhuizen naar een **nieuwe VPS met Ubuntu 26.04** en de PHP-versie die daarbij hoort.

**Randvoorwaarde:** de website (WordPress/WooCommerce) en de database moeten heel blijven.

---

## 🔦 Wat er op het oude stuk grond groeit

| Wat | Gevonden |
|---|---|
| Machine | Xen-VPS `emj-webshop`, 185.88.140.106, Ubuntu 22.04 |
| Schijf | **10 GB, 100% vol (nog 55 MB vrij)** |
| Webserver | nginx 1.18, één site: `winkel.eaumontjardin.fr` |
| PHP | 8.1 via `php8.1-fpm`. Extensies: curl, gd, intl, mbstring, mysql, soap, xml, xmlrpc, zip, opcache |
| Database | MySQL 8.0.32, database `wordpress` (44 MB), gebruiker `wordpressuser` (`caching_sha2_password`) |
| Website | WordPress 7.0.7 in `/var/www/winkel.eaumontjardin.fr/wordpress` (490 MB), thema twentytwentyfour-child, 16 plugins waaronder WooCommerce, WooCommerce Payments, GiveWP, Photonic, Visual Portfolio en WC GSheetConnector Pro |
| Certificaat | Let's Encrypt via de certbot-snap (nginx-plugin), geldig tot **9 januari 2027** |
| Back-ups | **Geen gevonden** |

Twee dingen om te weten voor je begint:

- **De winkel is dicht.** nginx is op 22 oktober 2026 om 06:15 met de hand gestopt en draait sindsdien niet. Ga na of dat met opzet was. Voor de verhuizing komt het goed uit: er komen nu geen nieuwe bestellingen binnen die je bij de overstap kwijt kunt raken.
- **De oude schijf is vol.** Een dump op de oude server wegschrijven lukt dus niet. Daarom streamen we hieronder alles via SSH direct naar je eigen machine.

In de voorbeelden heet de oude server `emj-webshop` en de nieuwe `emj-nieuw`. Zet die namen in je eigen `~/.ssh/config`.

---

## 🌰 Stap 1: Wintervoorraad aanleggen (back-ups)

Haal alles binnen op je eigen machine. Dit is meteen je vangnet en het materiaal voor de verhuizing.

```bash
mkdir -p emj-backup/etc

# Database, gestreamd zodat er niets op de volle schijf hoeft
ssh emj-webshop 'sudo mysqldump --defaults-file=/etc/mysql/debian.cnf \
  --single-transaction --routines --triggers --events \
  --databases wordpress | gzip' > emj-backup/wordpress-$(date +%F).sql.gz

# Bestanden en configuratie
rsync -az --rsync-path="sudo rsync" emj-webshop:/var/www/winkel.eaumontjardin.fr/ emj-backup/www/
rsync -az --rsync-path="sudo rsync" emj-webshop:/etc/nginx emj-webshop:/etc/php emj-webshop:/etc/mysql emj-backup/etc/
ssh emj-webshop 'sudo tar czf - /etc/letsencrypt' > emj-backup/letsencrypt.tgz

# Controle: is de dump compleet?
zcat emj-backup/wordpress-*.sql.gz | tail -1     # moet eindigen op "-- Dump completed"
```

Maak er ook een **snapshot van de oude VPS** bij de hoster bij, als dat kan.

## 🌱 Stap 2: Nieuwe grond klaarmaken

Bestel een nieuwe VPS met **Ubuntu 26.04** en minstens **20 GB** schijf. Log in met een SSH-sleutel en maak een eigen gebruiker met sudo, zodat je niet als root werkt.

```bash
sudo apt update && sudo apt full-upgrade

# Automatische beveiligingsupdates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Firewall: één systeem, alleen ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp        # certbot heeft 80 nodig om te vernieuwen
sudo ufw allow 443/tcp
sudo ufw enable

# Inbrekers aan de deur weren
sudo apt install fail2ban
```

Zet daarna in `/etc/ssh/sshd_config` de regel `PasswordAuthentication no` en herstart ssh. **Test eerst in een tweede terminal** of inloggen met je sleutel werkt, voordat je de eerste sessie sluit.

## 🌿 Stap 3: nginx, MySQL en PHP planten

Gebruik de PHP van Ubuntu 26.04 zelf, zonder PPA. Canonical patcht die jarenlang, en met unattended-upgrades blijft hij vanzelf op de laatste patchversie.

```bash
sudo apt install nginx mysql-server \
  php-fpm php-mysql php-curl php-gd php-intl php-mbstring php-soap php-xml php-zip

php -v                         # welke PHP-versie is het geworden?
php -m | grep -i opcache       # opcache hoort er standaard bij
apt policy php-xmlrpc          # bestaat dit nog? Alleen installeren als een plugin het echt nodig heeft
ls /run/php/                   # de naam van de FPM-socket, bijvoorbeeld php8.x-fpm.sock
```

Neem eigen PHP-instellingen over uit de back-up, zoals `upload_max_filesize`, `post_max_size` en `memory_limit`. Zo zie je wat er op de oude server afweek van de standaard:

```bash
grep -E '^(upload_max_filesize|post_max_size|memory_limit|max_execution_time)' emj-backup/etc/php/8.1/fpm/php.ini
```

Zet die waarden in `/etc/php/8.x/fpm/php.ini` op de nieuwe server en herstart `php8.x-fpm`.

## 🗄️ Stap 4: De database overzetten

Op 26.04 draait **MySQL 8.4**. `sudo mysql` werkt daar meteen, en `wordpressuser` gebruikt al `caching_sha2_password`, dus daar zit geen probleem.

Zoek het databasewachtwoord op in `emj-backup/www/wordpress/wp-config.php` (`DB_PASSWORD`) en maak de gebruiker aan:

```bash
sudo mysql -e "CREATE USER 'wordpressuser'@'localhost' IDENTIFIED BY '<wachtwoord uit wp-config.php>';"
```

Zet de dump erin. Die maakt de database `wordpress` zelf aan:

```bash
# Vanaf je eigen machine
scp emj-backup/wordpress-*.sql.gz emj-nieuw:/tmp/

# Op de nieuwe server
zcat /tmp/wordpress-*.sql.gz | sudo mysql
sudo mysql -e "GRANT ALL PRIVILEGES ON wordpress.* TO 'wordpressuser'@'localhost';"
```

## 📦 Stap 5: Bestanden, nginx en het certificaat

```bash
# Vanaf je eigen machine
rsync -az --rsync-path="sudo rsync" emj-backup/www/ emj-nieuw:/var/www/winkel.eaumontjardin.fr/
scp emj-backup/letsencrypt.tgz emj-backup/etc/nginx/sites-available/winkel.eaumontjardin.fr emj-nieuw:/tmp/
```

```bash
# Op de nieuwe server
sudo chown -R www-data:www-data /var/www/winkel.eaumontjardin.fr

# Het bestaande certificaat meenemen, zodat HTTPS meteen werkt
sudo tar xzf /tmp/letsencrypt.tgz -C /
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# nginx-config overnemen en naar de nieuwe PHP-socket laten wijzen
sudo cp /tmp/winkel.eaumontjardin.fr /etc/nginx/sites-available/
sudo sed -i 's#php8.1-fpm.sock#php8.x-fpm.sock#' /etc/nginx/sites-available/winkel.eaumontjardin.fr   # vul de echte versie in
sudo ln -s /etc/nginx/sites-available/winkel.eaumontjardin.fr /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 🔍 Stap 6: Stiekem proeven

Laat alleen je eigen computer naar de nieuwe server kijken. Zet in `/etc/hosts` op je eigen machine:

```
<ip-van-nieuwe-vps>  winkel.eaumontjardin.fr
```

**Test de winkel:** de voorpagina, de productpagina's, het winkelmandje, een testbestelling met WooCommerce Payments in testmodus, de wp-admin, de formulieren en of de bevestigingsmails aankomen.

Kijk in de WordPress-admin of alle **plugins en thema's** op de nieuwste versie staan. Let vooral op de betaalde of minder bekende plugins, zoals *wc-gsheetconnector-pro*, *photonic*, *integrate-google-drive* en *wpc-name-your-price*: werken ze met de nieuwe PHP-versie?

Haal de regel uit `/etc/hosts` weg als je klaar bent.

## 🧭 Stap 7: De wegwijzer omzetten

1. Zet een dag van tevoren de **TTL** van het DNS-record van `winkel.eaumontjardin.fr` laag, bijvoorbeeld 300 seconden.
2. Is de oude winkel intussen weer opengegaan? Doe hem dan dicht (zet nginx uit of zet WooCommerce in onderhoudsmodus) en herhaal **stap 1 en 4** voor de database. Zo neem je de laatste bestellingen mee.
3. Zet het **A-record** om naar het IP-adres van de nieuwe VPS.
4. Controleer daarna op de nieuwe server:

```bash
sudo certbot renew --dry-run          # werkt het vernieuwen van het certificaat?
systemctl is-active nginx php*-fpm mysql
sudo tail -f /var/log/nginx/error.log
```

## 🦉 Stap 8: De wacht houden

- Zet een **vaste back-up** op de nieuwe server op, bijvoorbeeld een nachtelijke `mysqldump` plus restic of borg naar opslag elders. Een webshop zonder back-up is als een eekhoorn zonder voorraad in november.
- Werk niet structureel met VS Code Remote als root op de server. Daardoor liep de oude schijf vol.
- Laat de **oude server nog een paar weken staan** als vangnet. Zet daar wel nginx uit, zodat niemand per ongeluk daar bestelt. Zeg hem daarna op.

---

## 🍃 Kort samengevat

1. **Back-ups** binnenhalen op je eigen machine: database (gestreamd), `/var/www`, `/etc` en `/etc/letsencrypt`.
2. **Nieuwe VPS** met Ubuntu 26.04 en minstens 20 GB, met unattended-upgrades, ufw, fail2ban en inloggen met sleutel.
3. **nginx, MySQL 8.4 en de PHP van 26.04** installeren en de `php.ini`-instellingen overnemen.
4. **Database** terugzetten en `wordpressuser` aanmaken.
5. **Bestanden, nginx-config en certificaat** overzetten en de socket aanpassen.
6. **Testen** via `/etc/hosts`.
7. **DNS omzetten**, eventueel na een laatste database-sync, en `certbot renew --dry-run` draaien.
8. **Vaste back-up** opzetten, de oude server een paar weken bewaren en daarna opzeggen.

Doe het op een rustige ochtend, niet op vrijdagmiddag, en niet midden in een drukke verkoopperiode. Neem een thermosfles koffie mee, en een kopie van de database in je rugzak.
