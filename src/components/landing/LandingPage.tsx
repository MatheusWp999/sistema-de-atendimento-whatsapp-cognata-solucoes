import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BarChart3, Bot, BrainCircuit, Building2, Check, Play, Smartphone, Sparkles, Users, WalletCards } from "lucide-react";
import { CognitaLogo } from "@/components/brand/CognitaLogo";

const features = [
  { title: "Atendimento IA 24/7", description: "Responda clientes no WhatsApp em segundos, mesmo fora do horario comercial.", icon: Bot },
  { title: "Controle humano", description: "Sua equipe assume conversas importantes sem perder o contexto gerado pela IA.", icon: Users },
  { title: "Base de conhecimento", description: "Treine respostas com regras, documentos, perguntas frequentes e dados da empresa.", icon: BrainCircuit },
  { title: "WhatsApp QR", description: "Conecte numeros por QR e acompanhe status de sessao direto no painel.", icon: Smartphone },
  { title: "Multiempresa", description: "Gerencie unidades, franquias, agencias ou clientes em ambientes isolados.", icon: Building2 },
  { title: "Consumo e performance", description: "Veja uso da IA, custo estimado, conversas e indicadores operacionais.", icon: BarChart3 },
];

const useCases = ["Vendas e qualificacao", "Suporte e pos-venda", "Agendamentos", "Financeiro e cobrancas", "Franquias e multiunidades", "Agencias de atendimento"];

const marketProofs = [
  { value: "24/7", label: "resposta automatica no WhatsApp" },
  { value: "7s", label: "experiencia de resposta imediata" },
  { value: "Multi", label: "empresas, unidades e clientes isolados" },
  { value: "IA+Humano", label: "automacao com controle da equipe" },
];

const comparisonRows = [
  ["Mensagens ficam espalhadas no celular", "Inbox centralizada com historico por cliente"],
  ["Leads esfriam esperando resposta", "IA responde, qualifica e prioriza oportunidades"],
  ["Equipe copia e cola as mesmas respostas", "Base de conhecimento treina respostas consistentes"],
  ["Gestor nao sabe o que converte", "Dashboard mostra volume, consumo e operacao"],
  ["Chatbot engessado frustra o cliente", "IA conversa em linguagem natural e chama humano"],
];

const roadmapItems = [
  "Inbox profissional com filas, responsaveis, status, tags e notas internas",
  "CRM leve para transformar conversas em leads, agendamentos e vendas",
  "Campanhas WhatsApp, templates oficiais e automacoes de follow-up",
  "Integracoes com CRM, agenda, pagamentos, planilhas, Make/n8n e webhooks",
  "Governanca de IA com fontes, logs, fallback humano e limites por plano",
];

const plans = [
  {
    name: "Essencial",
    tag: "Para comecar",
    price: "Sob consulta",
    description: "Ideal para empresas que querem automatizar o primeiro atendimento no WhatsApp.",
    items: ["Atendimento automatico", "Historico de conversas", "Base de conhecimento inicial", "Painel operacional"],
    featured: false,
  },
  {
    name: "Profissional",
    tag: "Mais escolhido",
    price: "Sob consulta",
    description: "Para equipes que precisam vender, atender e transferir conversas com controle.",
    items: ["Tudo do Essencial", "Takeover humano", "Relatorios de uso", "Multiplos usuarios", "Fluxos personalizados"],
    featured: true,
  },
  {
    name: "Multiempresa",
    tag: "Para escalar",
    price: "Sob consulta",
    description: "Para agencias, franquias e operacoes com varias empresas ou unidades.",
    items: ["Ambientes isolados", "Admin da plataforma", "Gestao por empresa", "Controle de consumo", "Suporte prioritario"],
    featured: false,
  },
];

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0078e7]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-white sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <CognitaLogo markClassName="h-10 w-36" textClassName="text-cyan-50" subtitle="Atendimento IA" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-300 md:flex">
          <a href="#funcionalidades" className="hover:text-white">Funcionalidades</a>
          <a href="#demos" className="hover:text-white">Demos</a>
          <a href="#planos" className="hover:text-white">Planos</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Login</Link>
          <Link href="/criar-conta" className="hidden rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-blue-950 hover:bg-white sm:inline-flex">Criar conta</Link>
        </div>
      </div>
    </header>
  );
}

function HeroDemo() {
  return (
    <div className="relative mx-auto max-w-xl rounded-[2rem] border border-cyan-200/20 bg-white/10 p-3 shadow-2xl shadow-blue-950/50 backdrop-blur">
      <div className="absolute -right-4 -top-5 rounded-2xl border border-cyan-200/50 bg-cyan-300 px-4 py-2 text-xs font-black text-blue-950 shadow-xl shadow-cyan-300/20">IA online</div>
      <div className="overflow-hidden rounded-[1.5rem] bg-slate-950 ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-300" />
            <span className="h-3 w-3 rounded-full bg-cyan-300" />
          </div>
          <span className="text-xs font-bold text-slate-400">cognita.app/dashboard</span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="hidden border-r border-white/10 bg-slate-900/80 p-4 lg:block">
            {['Nova conversa', 'Lead quente', 'Aguardando humano', 'Resolvido'].map((item, index) => (
              <div key={item} className={`landing-list-item mb-3 rounded-2xl border border-white/10 p-3 ${index === 1 ? 'bg-cyan-300/15' : 'bg-white/5'}`} style={{ animationDelay: `${index * 180}ms` }}>
                <p className="text-xs font-black text-white">{item}</p>
                <p className="mt-1 text-[11px] text-slate-400">WhatsApp +55 11 90000-00{index}</p>
              </div>
            ))}
          </aside>
          <div className="min-h-[410px] bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.24),_transparent_35%),#0f172a] p-4">
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
              <div>
                <p className="text-sm font-black text-white">Atendimento WhatsApp</p>
                <p className="text-xs text-cyan-100">IA treinada com sua empresa</p>
              </div>
              <span className="rounded-full bg-cyan-300 px-3 py-1 text-[11px] font-black text-blue-950">Conectado</span>
            </div>
            <div className="space-y-3">
              <div className="landing-bubble max-w-[82%] rounded-2xl rounded-bl-sm bg-white p-3 text-sm text-slate-900">Ola, voces atendem hoje?</div>
              <div className="landing-typing ml-auto flex w-fit gap-1 rounded-2xl rounded-br-sm bg-cyan-300 px-4 py-3">
                <span /><span /><span />
              </div>
              <div className="landing-bubble ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-cyan-300 p-3 text-sm font-semibold text-blue-950" style={{ animationDelay: '900ms' }}>
                Sim. Nosso atendimento funciona ate 18h. Posso adiantar seu pedido e chamar um especialista se precisar.
              </div>
              <div className="landing-bubble max-w-[82%] rounded-2xl rounded-bl-sm bg-white p-3 text-sm text-slate-900" style={{ animationDelay: '1300ms' }}>Quero saber os planos para minha empresa.</div>
              <div className="landing-bubble ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-blue-300 p-3 text-sm font-semibold text-blue-950" style={{ animationDelay: '1700ms' }}>
                Perfeito. Identifiquei interesse comercial e vou enviar as opcoes ou transferir para um atendente.
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/10 p-3"><strong className="block text-lg text-white">98%</strong><span className="text-slate-400">respondidas</span></div>
              <div className="rounded-2xl bg-white/10 p-3"><strong className="block text-lg text-white">7s</strong><span className="text-slate-400">resposta</span></div>
              <div className="rounded-2xl bg-white/10 p-3"><strong className="block text-lg text-white">24/7</strong><span className="text-slate-400">online</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="border-b border-slate-100 p-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700"><Play size={13} /> GIF interno</div>
        <h3 className="text-xl font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="min-h-[260px] bg-slate-950 p-5 text-white">{children}</div>
    </article>
  );
}

function QrDemo() {
  return (
    <div className="grid h-full place-items-center">
      <div className="relative rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
        <div className="landing-scan absolute left-5 right-5 top-5 h-1 rounded-full bg-cyan-300 shadow-lg shadow-cyan-300" />
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 25 }).map((_, index) => <span key={index} className={`h-7 w-7 rounded ${index % 3 === 0 || index % 7 === 0 ? 'bg-slate-950' : 'bg-slate-200'}`} />)}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-sky-50 py-2 text-sm font-black text-blue-700"><Check size={16} /> WhatsApp conectado</div>
      </div>
    </div>
  );
}

function KnowledgeDemo() {
  return (
    <div className="space-y-3">
      {['FAQ de vendas.pdf', 'Politica comercial', 'Produtos e precos'].map((item, index) => (
        <div key={item} className="landing-list-item rounded-2xl border border-white/10 bg-white/10 p-4" style={{ animationDelay: `${index * 220}ms` }}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold">{item}</span>
            <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-blue-950">Treinado</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="landing-progress h-full rounded-full bg-cyan-300" /></div>
        </div>
      ))}
      <div className="rounded-2xl bg-blue-300 p-4 text-sm font-bold text-blue-950">A IA responde usando as regras reais da sua empresa.</div>
    </div>
  );
}

function AdminDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-2">
        {['Matriz', 'Unidade Norte', 'Cliente Agencia'].map((item, index) => <div key={item} className={`rounded-2xl p-3 text-sm font-bold ${index === 1 ? 'bg-cyan-300 text-blue-950' : 'bg-white/10 text-white'}`}>{item}</div>)}
      </div>
      <div className="rounded-3xl bg-white p-4 text-slate-950">
        <p className="text-xs font-black uppercase tracking-wide text-blue-600">Painel admin</p>
        <strong className="mt-1 block text-2xl">3 empresas</strong>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded-full bg-slate-200"><div className="landing-width-a h-3 rounded-full bg-sky-500" /></div>
          <div className="h-3 w-full rounded-full bg-slate-200"><div className="landing-width-b h-3 rounded-full bg-cyan-400" /></div>
          <div className="h-3 w-full rounded-full bg-slate-200"><div className="landing-width-c h-3 rounded-full bg-blue-700" /></div>
        </div>
        <button className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Criar nova conta</button>
      </div>
    </div>
  );
}

function UsageDemo() {
  return (
    <div className="rounded-3xl bg-white p-5 text-slate-950">
      <div className="flex items-center justify-between">
        <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Consumo IA</p><strong className="text-2xl">R$ 42,80</strong></div>
        <WalletCards className="text-blue-600" />
      </div>
      <div className="mt-6 flex h-32 items-end gap-2">
        {[45, 70, 52, 88, 66, 94, 76].map((height, index) => <span key={index} className="landing-bar flex-1 rounded-t-xl bg-sky-500" style={{ height: `${height}%`, animationDelay: `${index * 100}ms` }} />)}
      </div>
      <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-bold text-blue-700">Uso por empresa, periodo e provedor.</p>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <Header />
      <section className="relative bg-[radial-gradient(circle_at_top_left,_rgba(45,212,255,0.36),_transparent_30%),linear-gradient(135deg,#006bd6,#088df4_48%,#06b7ff)] px-4 pb-20 pt-32 text-white sm:px-6 lg:px-8 lg:pb-28">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:64px_64px] opacity-25" />
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_22%_35%,transparent_0_9rem,rgba(125,229,255,0.5)_9.08rem,transparent_9.18rem),radial-gradient(circle_at_72%_28%,transparent_0_7rem,rgba(125,229,255,0.45)_7.08rem,transparent_7.18rem),radial-gradient(circle_at_57%_68%,transparent_0_8rem,rgba(125,229,255,0.3)_8.08rem,transparent_8.18rem)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-8 inline-flex rounded-[2rem] bg-white/10 px-5 py-4 shadow-2xl shadow-blue-950/20 ring-1 ring-white/15 backdrop-blur">
              <CognitaLogo markClassName="h-20 w-64 sm:h-24 sm:w-80" textClassName="text-cyan-50" subtitle="Inteligencia para atendimento" />
            </div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-100/50 bg-white/12 px-4 py-2 text-sm font-bold text-cyan-50"><Sparkles size={16} /> Cognita: IA + WhatsApp + atendimento humano</div>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">Venda mais pelo WhatsApp sem aumentar sua equipe.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-50">A Cognita responde clientes em segundos, qualifica leads, agenda atendimentos, transfere para humanos quando necessario e mostra tudo em um painel multiempresa.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/criar-conta" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-black uppercase text-blue-700 shadow-xl shadow-blue-950/20 hover:bg-cyan-50">Criar conta <ArrowRight size={18} /></Link>
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-4 text-sm font-black uppercase text-white hover:bg-white/10">Login</Link>
              <a href="#demos" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-4 text-sm font-black uppercase text-white hover:bg-white/10">Ver demos internas</a>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {marketProofs.map((proof) => (
                <div key={proof.value} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <strong className="block text-2xl">{proof.value}</strong>
                  <span className="text-blue-100/80">{proof.label}</span>
                </div>
              ))}
            </div>
          </div>
          <HeroDemo />
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[2rem] bg-slate-950 p-8 text-white">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-100">Antes e depois</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">WhatsApp manual perde vendas. Cognita organiza e converte.</h2>
              <p className="mt-4 leading-7 text-slate-300">O mercado vende resultado: menos demora, mais conversas qualificadas e mais controle para o gestor. A Cognita assume essa mesma proposta competitiva.</p>
              <Link href="/criar-conta" className="mt-7 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black uppercase text-blue-950 hover:bg-white">Solicitar acesso <ArrowRight size={16} /></Link>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-sky-50 shadow-xl shadow-sky-100">
              <div className="grid bg-blue-700 px-5 py-4 text-sm font-black uppercase tracking-wide text-white sm:grid-cols-2">
                <span>Sem Cognita</span>
                <span className="hidden sm:block">Com Cognita</span>
              </div>
              {comparisonRows.map(([before, after]) => (
                <div key={before} className="grid gap-3 border-t border-sky-100 bg-white p-5 text-sm sm:grid-cols-2">
                  <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800">{before}</p>
                  <p className="rounded-2xl bg-sky-50 p-4 font-semibold text-blue-800">{after}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">Funcionalidades</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Uma central para capturar, atender, qualificar e acompanhar resultados.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-sky-200 hover:bg-white hover:shadow-xl hover:shadow-sky-100">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-cyan-100"><Icon size={22} /></div>
                <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
                <p className="mt-2 leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="demos" className="bg-slate-100 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">GIFs internos da Cognita</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Veja os fluxos principais em movimento.</h2>
              <p className="mt-4 text-slate-600">As demos abaixo simulam telas internas do produto: conversa com IA, QR WhatsApp, conhecimento, admin multiempresa e consumo.</p>
            </div>
            <Link href="/criar-conta" className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-black uppercase text-white hover:bg-blue-800">Solicitar acesso <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <DemoCard title="WhatsApp conectado por QR" description="Conecte o canal, acompanhe status e deixe a IA pronta para atender."><QrDemo /></DemoCard>
            <DemoCard title="IA treinada com conhecimento" description="Documentos, regras e FAQs alimentam respostas alinhadas ao seu negocio."><KnowledgeDemo /></DemoCard>
            <DemoCard title="Admin multiempresa" description="Crie contas empresariais, acompanhe status e administre operacoes isoladas."><AdminDemo /></DemoCard>
            <DemoCard title="Consumo e custos" description="Monitore uso de IA, volume operacional e gasto estimado por empresa."><UsageDemo /></DemoCard>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#005ccc,#0796f2)] p-8 text-white shadow-xl shadow-blue-200">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-100">Possibilidades</p>
            <h2 className="mt-3 text-4xl font-black">Automatize sem engessar sua operacao.</h2>
            <p className="mt-4 leading-7 text-slate-300">A plataforma combina resposta automatica, controle humano, historico centralizado e visao de gestao para equipes que precisam atender melhor no WhatsApp.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {useCases.map((item) => <div key={item} className="rounded-2xl border border-sky-100 bg-white p-5 font-black text-slate-800 shadow-sm shadow-sky-50"><Check className="mb-3 text-blue-600" />{item}</div>)}
          </div>
        </div>
      </section>

      <section className="bg-slate-100 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">Nivel competitivo</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">O que estamos preparando para disputar com players fortes.</h2>
            <p className="mt-4 leading-7 text-slate-600">Zenvia, Blip, WATI, respond.io, SleekFlow, BotConversa e Kommo mostram que o usuario compra resultado, automacao comercial, inbox profissional e confianca. Este e o caminho de evolucao da Cognita.</p>
          </div>
          <div className="space-y-3">
            {roadmapItems.map((item, index) => (
              <div key={item} className="flex gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-sky-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-700 text-sm font-black text-white">{index + 1}</span>
                <p className="font-bold leading-6 text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="bg-[linear-gradient(135deg,#031b5f,#005ccc_55%,#0796f2)] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-100">Planos Cognita</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Escolha o modelo ideal para seu volume de atendimento.</h2>
            <p className="mt-4 text-slate-300">Os planos podem ser ajustados por numero de empresas, usuarios, consumo de IA e nivel de suporte.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`rounded-[2rem] p-6 ${plan.featured ? 'bg-white text-blue-950 shadow-2xl shadow-cyan-300/20' : 'border border-white/15 bg-white/8 text-white'}`}>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${plan.featured ? 'bg-blue-700 text-white' : 'bg-white/10 text-cyan-100'}`}>{plan.tag}</span>
                <h3 className="mt-5 text-2xl font-black">{plan.name}</h3>
                <p className={`mt-2 min-h-[72px] leading-6 ${plan.featured ? 'text-blue-900' : 'text-blue-50'}`}>{plan.description}</p>
                <strong className="mt-5 block text-3xl">{plan.price}</strong>
                <ul className="mt-6 space-y-3">
                  {plan.items.map((item) => <li key={item} className="flex gap-2 text-sm font-semibold"><Check size={18} className={plan.featured ? 'text-blue-700' : 'text-cyan-100'} />{item}</li>)}
                </ul>
                <Link href="/criar-conta" className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-black uppercase ${plan.featured ? 'bg-blue-700 text-white hover:bg-blue-800' : 'bg-white text-blue-700 hover:bg-cyan-50'}`}>Solicitar este plano</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-[linear-gradient(135deg,#e0f2fe,#eff6ff)] p-8 shadow-xl shadow-sky-100 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-700">Pronto para operar?</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-black text-slate-950">Transforme seu WhatsApp em uma central inteligente de vendas e atendimento.</h2>
          </div>
          <Link href="/criar-conta" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-blue-700 px-6 py-4 text-sm font-black uppercase text-white hover:bg-blue-800">Criar conta <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
  );
}
