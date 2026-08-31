# Deploying to the VPS

The server already runs a separate `blog` stack whose nginx container owns
ports 80 and 443 and renews certificates through a certbot container. This app
joins that stack's network rather than running a proxy of its own.

Everything below is a **one-time** setup. After it, pushing to `main` deploys.

## Why it is wired this way

`blog-nginx-1` proxies to backends by container name over the `blog_default`
network (`proxy_pass http://frontend:3000`). A container cannot reach the
host's `127.0.0.1`, so publishing ports to host loopback would not work. The
`sql-api` and `sql-frontend` services therefore attach to `blog_default` and
are addressed by name.

Compose registers each service name as a network alias, and the blog stack
already has a service called `frontend`. Hence the `sql-` prefixes: two
containers answering to `frontend` on one network resolve unpredictably.

`sql-db` stays off the shared network entirely.

## One-time setup

### 1. DNS

An `A` record for `sql.elsayed2002.tech` pointing at the server. Confirm before
continuing, or certbot will fail:

```bash
dig +short A sql.elsayed2002.tech
```

### 2. Server directory and secrets

```bash
ssh root@<host>
mkdir -p /root/text-to-sql-agent
```

Create `/root/text-to-sql-agent/.env` (see `.env.example`). It is never
deployed from the repo — CI copies only the compose file and `db/`.

```
POSTGRES_PASSWORD=...
APP_RO_PASSWORD=...
GOOGLE_API_KEY=...
ALLOWED_ORIGINS=https://sql.elsayed2002.tech
DOCKERHUB_USERNAME=...
```

### 3. Certificate, before any TLS config

nginx refuses to start when a config references a certificate that does not
exist — and this nginx serves the blog. Adding the TLS block first takes the
blog down at the next reload. So: HTTP first, certificate, then TLS.

```bash
cp deploy/nginx/01-sql-bootstrap.conf /opt/blog/nginx/conf.d/
docker exec blog-nginx-1 nginx -t && docker exec blog-nginx-1 nginx -s reload
```

`nginx -t` validates without applying. Never reload without it.

```bash
docker run --rm \
  -v blog_certbot-etc:/etc/letsencrypt \
  -v blog_certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d sql.elsayed2002.tech --email <you@example.com> --agree-tos --no-eff-email
```

The blog's certbot container renews it from then on; it renews everything in
that volume.

### 4. TLS config

The proxy config resolves upstreams at request time (`resolver 127.0.0.11`)
rather than at startup. That is deliberate: with literal container names,
`nginx -t` fails whenever the sql-* containers are down, which would prevent
this nginx -- the one serving the blog -- from reloading or restarting.

```bash
rm /opt/blog/nginx/conf.d/01-sql-bootstrap.conf
cp deploy/nginx/02-sql.conf /opt/blog/nginx/conf.d/
docker exec blog-nginx-1 nginx -t && docker exec blog-nginx-1 nginx -s reload
```

### 5. First deploy

Push to `main`, or run the CD workflow manually.

## Rolling back

Images are tagged by commit SHA as well as `latest`, so a bad release does not
need a revert commit:

```bash
cd /root/text-to-sql-agent
TAG=<previous-sha> docker compose -f docker-compose.prod.yml up -d
```

## Notes

- `docker compose` only manages services in its own project, so nothing here
  touches the blog's containers.
- `docker image prune -f` in the deploy job removes only dangling images;
  tagged blog images are unaffected.
- The frontend's API URL is compiled into its bundle at build time
  (`PUBLIC_API_URL` secret), so changing it requires a rebuild, not a restart.
