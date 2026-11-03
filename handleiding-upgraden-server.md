# Het grote verhuisplan van de bos-server

*Een handleiding voor Tom en Ruerd, bosnymfen van het eerste uur*
*Op maat gemaakt na een verkenning van `emj-webshop` (winkel.eaumontjardin.fr) op 3 november 2026*

Kijk eens aan, daar staan jullie dan, Tom en Ruerd, onder de oude eik met de pet op en de mouwen al opgestroopt. Een goede bosbewoner weet dat je een oude boom niet in één nacht verplant. Eerst kijk je hoe de wortels lopen. Dan graaf je met beleid. En je zet altijd een emmer water klaar voor als het tegenzit.

We zijn met een lantaarn langs de wortels van jullie boom gegaan. We hebben **niets veranderd**, alleen gekeken. Wat we zagen staat hieronder, en daarna volgt het plan.

**Doel:**

- Ubuntu upgraden van 22.04 naar 26.04
- PHP upgraden naar de laatste gepatchte versie

**Randvoorwaarde:** de website (WordPress/WooCommerce) met database moet blijven bestaan.

---

## 🔦 Wat er in het bos groeit

| Wat | Gevonden |
|---|---|
| Machine | Xen-VPS, 185.88.140.106. De kernel (6.12.53) komt van de hoster, niet van Ubuntu: er zijn geen `linux-image`-pakketten geïnstalleerd |
| Ubuntu | 22.04 LTS, al **354 dagen** niet herstart, **114 updates** staan klaar |
| Schijf | **10 GB, 100% vol (nog 55 MB vrij)** |
| Webserver | nginx 1.18, één site: `winkel.eaumontjardin.fr` |
| PHP | **8.1.2-1ubuntu2.11 (februari 2023)**, via `php8.1-fpm`. Extensies: curl, gd, intl, mbstring, mysql, soap, xml, xmlrpc, zip, opcache |
| Apt-bronnen | Alleen de Ubuntu-archieven (main en universe), **geen PPA's** |
| Database | MySQL 8.0.32, database `wordpress` (44 MB), gebruiker `wordpressuser` |
| Website | WordPress 7.0.7 in `/var/www/winkel.eaumontjardin.fr/wordpress` (490 MB), thema twentytwentyfour-child, 16 plugins waaronder WooCommerce, WooCommerce Payments, GiveWP, Photonic, Visual Portfolio en WC GSheetConnector Pro |
| Certificaat | Let's Encrypt via de certbot-snap (nginx-plugin), geldig tot **9 januari 2027** |
| Firewall | ufw staat aan met alleen 443 open, en **daarnaast** staan er eigen iptables-regels voor 22, 80 en 443 |
| Back-ups | **Geen gevonden.** Er is geen cronjob, en `/var/www/backup` is leeg |

---

## 🚨 Drie dingen die eerst aandacht vragen

### 1. De winkel is dicht

**nginx draait niet.** Op 22 oktober 2026 om 06:15 heeft root hem met de hand gestopt (`nginx -s quit`), en sindsdien is de webshop onbereikbaar. Misschien was dat met opzet. Ga het in ieder geval na. Moet de winkel weer open, dan is dat:

```bash
sudo systemctl start nginx
```

Zolang nginx uit staat, kan certbot het certificaat ook niet vernieuwen. Dat moet vóór 9 januari 2027 gebeuren, en certbot gaat het rond half december proberen.

### 2. De schijf is vol

Een upgrade naar een nieuwe Ubuntu-versie heeft **enkele gigabytes** vrij nodig. Er is nu 55 MB vrij. Dit zijn de grootste vreters:

| Wat | Grootte | Wat je ermee kunt doen |
|---|---|---|
| `/root/.vscode-server` (27 oude serverversies, plus een Copilot-index van 674 MB) | **5,9 GB** | Verwijderen. VS Code zet het opnieuw neer bij de volgende verbinding |
| systemd-journal | 800 MB | `journalctl --vacuum-size=100M` |
| `/var/log/btmp.1` (mislukte inlogpogingen, oftewel inbrekers aan de deur) | 168 MB | Leegmaken |
| snapd-cache | 117 MB | Ruimt zichzelf op |

```bash
# Sluit eerst alle VS Code Remote-sessies naar deze server
sudo rm -rf /root/.vscode-server
sudo journalctl --vacuum-size=100M
sudo truncate -s 0 /var/log/btmp.1
df -h /
```

Daarmee komt er zo'n **6,5 GB** vrij. Ga liever niet structureel met VS Code Remote als root op deze kleine productieserver werken: dan loopt hij zo weer vol.

Overweeg daarnaast de schijf bij de hoster te **vergroten naar 20 GB of meer**. 10 GB is krap voor een webshop en twee release-upgrades.

### 3. Er zijn geen back-ups

Een webshop met bestellingen en klantgegevens zonder back-up is als een eekhoorn zonder voorraad in november. Regel dit eerst, los van de upgrade (zie stap 1).

---

## 🦔 De keuze: verplanten of opnieuw zaaien?

Kijkend naar dit bos raden we **nadrukkelijk aan om opnieuw te zaaien:**

- De site is klein (490 MB aan bestanden en 44 MB database), dus verhuizen is zo gebeurd.
- De huidige schijf is te klein, en de server zit vol oude rommel.
- Er moeten twee release-upgrades achter elkaar, en elk van die twee kan de webshop breken.
- De kernel komt van de hoster. Of de 26.04-gebruikersomgeving prettig samengaat met hun Xen-kernel, weet je pas als het draait.

### Pad A, aanbevolen: een nieuwe VPS met 26.04

1. Bestel een nieuwe VPS met **Ubuntu 26.04** en minstens **20 GB** schijf.
2. Installeer daarop nginx, MySQL en PHP uit de 26.04-archieven (zie stap 5 voor de pakketlijst).
3. Zet de bestanden (`rsync`) en de database (dump en restore) over. Kopieer de nginx-config en pas de PHP-FPM-socket aan.
4. Test via je eigen `/etc/hosts`, zodat alleen jij de nieuwe server ziet.
5. Zet de DNS van `winkel.eaumontjardin.fr` om en vraag met certbot een nieuw certificaat aan.
6. Laat de oude server nog een paar weken staan als vangnet en zeg hem daarna op.

### Pad B: in-place upgraden op deze server

Dan volg je de stappen hieronder.

---

## 🌰 Stap 1: Wintervoorraad aanleggen (back-ups)

Leg dit allemaal weg **buiten de server**, op je eigen machine of op opslag elders:

```bash
# Op de server: database dumpen. Root heeft een wachtwoord, dus we gebruiken het onderhoudsaccount van Debian
sudo mysqldump --defaults-file=/etc/mysql/debian.cnf \
  --single-transaction --routines --triggers --events \
  --databases wordpress | gzip > /tmp/wordpress-$(date +%F).sql.gz

# Vanaf je eigen machine: alles binnenhalen
rsync -az emj-webshop:/tmp/wordpress-*.sql.gz ./emj-backup/
rsync -az emj-webshop:/var/www/winkel.eaumontjardin.fr/ ./emj-backup/www/
rsync -az emj-webshop:/etc/nginx emj-webshop:/etc/php emj-webshop:/etc/mysql ./emj-backup/etc/
ssh emj-webshop 'sudo tar czf - /etc/letsencrypt' > ./emj-backup/letsencrypt.tgz
```

- Maak een **snapshot van de VPS** bij de hoster, als dat kan.
- Zet daarna een **vaste back-up** op, bijvoorbeeld een nachtelijke dump plus restic of borg naar opslag elders. Dat hoeft niet te wachten op de upgrade.

## 🍂 Stap 2: Voorbereiden

```bash
# Ruimte maken: zie "De schijf is vol" hierboven
df -h /                      # minstens 5 GB vrij voordat je verdergaat

# Alle openstaande updates binnen 22.04 eerst installeren (dat zijn er 114)
sudo apt update && sudo apt full-upgrade
sudo apt autoremove --purge
sudo reboot                  # de eerste herstart in een jaar, dus kijk of alles netjes terugkomt
```

**De MySQL-root-gebruiker** gebruikt nu `mysql_native_password`. Die aanmeldmethode staat in MySQL 8.4, de versie van 26.04, **standaard uit**. Zet root daarom nu al om naar de Ubuntu-standaard, zodat `sudo mysql` zonder wachtwoord werkt:

```bash
sudo mysql --defaults-file=/etc/mysql/debian.cnf \
  -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH auth_socket;"
sudo mysql -e "SELECT user, plugin FROM mysql.user;"   # dit moet nu werken
```

`wordpressuser` gebruikt al `caching_sha2_password`, dus de website zelf zit goed.

**Plugins:** WordPress 7.0.7 werkt prima op nieuwe PHP-versies, maar zet in de WordPress-admin ook alle **plugins en thema's** op de nieuwste versie. Kijk vooral bij de betaalde of minder bekende plugins, zoals *wc-gsheetconnector-pro*, *photonic*, *integrate-google-drive* en *wpc-name-your-price*, of ze PHP 8.4/8.5 ondersteunen.

## 🌲 Stap 3: Eerste stapsteen, van 22.04 naar 24.04

```bash
sudo apt install tmux
tmux new -s upgrade          # raakt de verbinding kwijt? Dan haal je de sessie terug met: tmux attach -t upgrade
sudo do-release-upgrade
```

- Vraagt hij of hij een configbestand mag vervangen (`php.ini`, `my.cnf`, `nginx.conf`)? Kies dan **"keep your version"**.
- De upgrader biedt een noodpoort 1022 aan. Die staat in jullie firewall dicht, maar dat is niet erg zolang je in tmux werkt.
- Er wordt geen kernel geïnstalleerd, want die komt van de hoster. Dat is in orde.

**Na de herstart is PHP 8.3 geworden.** De nginx-config wijst dan nog naar de oude socket:

```bash
sudo apt install php8.3-fpm php8.3-mysql php8.3-curl php8.3-gd php8.3-intl \
  php8.3-mbstring php8.3-soap php8.3-xml php8.3-zip php8.3-opcache
# php-xmlrpc: kijk of het pakket nog bestaat (apt policy php8.3-xmlrpc) en of een plugin het echt nodig heeft

sudo sed -i 's#php8.1-fpm.sock#php8.3-fpm.sock#' /etc/nginx/sites-available/winkel.eaumontjardin.fr
sudo nginx -t && sudo systemctl reload nginx
```

Neem eventuele eigen instellingen uit `/etc/php/8.1/fpm/php.ini` over naar `/etc/php/8.3/fpm/php.ini`, zoals `upload_max_filesize` en `memory_limit`.

**Test de winkel:** de voorpagina, de productpagina's, het winkelmandje, een testbestelling met WooCommerce Payments in testmodus, de wp-admin en de formulieren. Maak daarna **een nieuwe snapshot en een nieuwe dump**.

## 🌳 Stap 4: Tweede stapsteen, van 24.04 naar 26.04

```bash
sudo apt update && sudo apt full-upgrade && sudo reboot
tmux new -s upgrade
sudo do-release-upgrade
```

- Zegt hij "no new release found"? Kijk dan of in `/etc/update-manager/release-upgrades` de regel `Prompt=lts` staat.
- MySQL gaat hier van 8.0 naar **8.4**. Dankzij stap 2 heeft dat geen gevolgen meer voor de root-gebruiker.

Daarna doe je hetzelfde rondje als bij stap 3, maar dan met de PHP-versie van 26.04 (vraag die op met `apt policy php-fpm`): de `php8.x-*`-pakketten installeren, de socket in de nginx-config aanpassen, de `php.ini` overnemen en de winkel testen.

## 🐌 Stap 5: PHP op de laatste patchversie houden

Er staan geen PPA's op deze server, en dat is goed zo. **Blijf bij de PHP van Ubuntu 26.04.** Canonical patcht die jarenlang, en dat is makkelijker te onderhouden dan een PPA.

Het grootste lek van nu is niet de PHP-versie, maar dat **er al bijna drie jaar niet gepatcht is** (de PHP-build is van februari 2023). Daarom:

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Wil je per se de allernieuwste versie van php.net, dan kan dat met `ppa:ondrej/php`. Voeg die pas toe **na** de laatste release-upgrade.

## 🦉 Stap 6: Opruimen en de wacht houden

```bash
sudo apt autoremove --purge                  # oude php8.1- en php8.3-pakketten weg
sudo systemctl --failed
systemctl is-active nginx php*-fpm mysql
sudo certbot renew --dry-run                 # werkt de vernieuwing van het certificaat nog?
sudo tail -f /var/log/nginx/error.log /var/log/php*-fpm.log
```

**De firewall rechttrekken:** ufw (alleen 443) en de eigen iptables-regels (22, 80 en 443) lopen nu door elkaar. Kies er één. Houd poort 80 open, want certbot heeft die nodig om te vernieuwen. En kijk naar de mislukte inlogpogingen in `btmp`: zet `fail2ban` aan en schakel inloggen met een wachtwoord via SSH uit.

---

## 🍃 Kort samengevat

1. **Ga na** waarom nginx sinds 22 oktober uit staat, en of de winkel weer open moet.
2. **Leg back-ups aan:** een databasedump, `/var/www`, `/etc` en `/etc/letsencrypt`, allemaal buiten de server.
3. **Kies:** een nieuwe VPS met 26.04 (aanbevolen), of in-place upgraden.
4. Bij in-place: **maak ruimte** (vooral `.vscode-server`, goed voor 5,9 GB), installeer de 114 updates, zet MySQL-root om naar `auth_socket` en werk de plugins bij.
5. Upgrade naar **24.04**, ga over op `php8.3-fpm`, test en maak een back-up.
6. Upgrade naar **26.04**, ga over op de nieuwe PHP, test en maak een back-up.
7. Zet **unattended-upgrades** aan, trek de firewall recht en zet een vaste back-up op.

Doe het op een rustige ochtend, niet op vrijdagmiddag. Het blijft een webshop, dus doe het ook niet midden in een drukke verkoopperiode. Neem een thermosfles koffie mee, en een kopie van de database in je rugzak.
