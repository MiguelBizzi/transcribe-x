import { Video, Twitter, Github, Linkedin } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="from-primary to-secondary rounded-lg bg-linear-to-br p-2">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">TranscribeX</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Transcreva vídeos do YouTube com precisão de IA. Ideal para
              criadores, pesquisadores e profissionais de dados.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="bg-muted hover:bg-muted/80 rounded-lg p-2 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="bg-muted hover:bg-muted/80 rounded-lg p-2 transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="bg-muted hover:bg-muted/80 rounded-lg p-2 transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold">Produto</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Documentação da API
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Histórico de mudanças
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold">Suporte</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Central de ajuda
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Fale conosco
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Status
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Comunidade
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold">Jurídico</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Política de privacidade
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Termos de uso
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Política de cookies
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  LGPD
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-muted-foreground text-sm">
            © 2024 TranscribeX. Todos os direitos reservados.
          </p>
          <p className="text-muted-foreground text-sm">
            Feito com ❤️ para criadores no mundo todo
          </p>
        </div>
      </div>
    </footer>
  )
}
