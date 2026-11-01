"""Serveur local de développement, sans cache.

Le serveur standard (python3 -m http.server) laisse le navigateur garder
d'anciennes versions des fichiers JavaScript : après une modification, on
voit encore l'ancien comportement. Celui-ci interdit le cache.

Usage, depuis la racine du projet :  python3 outils/serveur.py [port]
"""
import http.server
import sys


class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f"Carte de MJ : http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), SansCache).serve_forever()
