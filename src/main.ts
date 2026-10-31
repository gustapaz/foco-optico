import {
  app,
  h,
  text,
  type TypedH,
  type Action,
  type Effecter,
} from "hyperapp";
import {
  scenes,
  apertures,
  speeds,
  isos,
  defaults,
  fresh,
  valid,
  exposure,
  visual,
  parse,
  add,
  describe,
  exportText,
  type Data,
  type Settings,
  type Shot,
} from "./model";
import "./style.css";
type State = {
  settings: Settings;
  data: Data;
  modal: string;
  message: string;
  note: string;
  compare: number;
  grid: boolean;
  reference: boolean;
};
let data = fresh(),
  warning = "";
try {
  const raw = localStorage.getItem("foco:1");
  if (raw) {
    const p = parse(raw);
    if (p) data = p;
    else warning = "O arquivo salvo não pôde ser lido. Começamos um novo.";
  }
} catch {
  warning = "Armazenamento indisponível. Os ensaios ficam apenas nesta visita.";
}
const v: TypedH<State> = h;
const Message: Action<State, string> = (s, message) => ({ ...s, message });
const Persist: Effecter<State, Data> = (dispatch, d) => {
  try {
    localStorage.setItem("foco:1", JSON.stringify(d));
  } catch {
    dispatch(Message, "Não foi possível salvar. Exporte seus ensaios.");
  }
};
const Set: Action<State, Partial<Settings>> = (s, patch) => {
  const p = { ...s.settings, ...patch };
  return valid(p) ? { ...s, settings: p, reference: false } : s;
};
const CloseEffect: Effecter<State> = () =>
  document.querySelector<HTMLDialogElement>("#panel")?.close();
const Close: Action<State> = (s) => [{ ...s, modal: "" }, CloseEffect];
const OpenEffect: Effecter<State> = () => {
  requestAnimationFrame(() =>
    document.querySelector<HTMLDialogElement>("#panel")?.showModal(),
  );
};
const Open: Action<State, string> = (s, modal) => [{ ...s, modal }, OpenEffect];
let sequence = 0;
const SwitchEffect: Effecter<State, { id: string; quiet: boolean }> = (
  dispatch,
  { id, quiet },
) => {
  const token = ++sequence,
    overlay = document.querySelector<HTMLElement>(".iris")!;
  overlay.getAnimations().forEach((a) => a.cancel());
  overlay.style.clipPath = "circle(0%)";
  if (quiet || !overlay.animate) {
    dispatch(Set, { scene: id });
    return;
  }
  const close = overlay.animate(
    [{ clipPath: "circle(0%)" }, { clipPath: "circle(150%)" }],
    { duration: 230, fill: "forwards", easing: "cubic-bezier(.7,0,.3,1)" },
  );
  close.finished
    .then(() => {
      if (token !== sequence) return;
      dispatch(Set, { scene: id });
      close.cancel();
      overlay.animate(
        [{ clipPath: "circle(150%)" }, { clipPath: "circle(0%)" }],
        { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    })
    .catch(() => {});
};
const Switch: Action<State, string> = (s, id) =>
  scenes.some((a) => a.id === id)
    ? [
        s,
        [
          SwitchEffect,
          {
            id,
            quiet:
              s.data.reduced ||
              matchMedia("(prefers-reduced-motion: reduce)").matches,
          },
        ],
      ]
    : s;
const Added: Action<State, Shot> = (s, shot) => {
  const data = add(s.data, shot);
  return [
    { ...s, data, message: "Ensaio guardado no seu arquivo.", note: "" },
    [Persist, data],
  ];
};
const SaveEffect: Effecter<State, { settings: Settings; note: string }> = (
  dispatch,
  p,
) =>
  dispatch(Added, {
    id: "F-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    at: Date.now(),
    settings: { ...p.settings },
    note: p.note.trim().slice(0, 180),
  });
const Save: Action<State> = (s) => [
  s,
  [SaveEffect, { settings: s.settings, note: s.note }],
];
const Remove: Action<State, string> = (s, id) => {
  const data = { ...s.data, shots: s.data.shots.filter((v) => v.id !== id) };
  return [{ ...s, data }, [Persist, data]];
};
const Use: Action<State, Settings> = (s, p) => [
  { ...s, settings: { ...p }, reference: false, modal: "" },
  CloseEffect,
];
const Reduced: Action<State> = (s) => {
  const data = { ...s.data, reduced: !s.data.reduced };
  return [{ ...s, data }, [Persist, data]];
};
const Download: Effecter<State, Data> = (_, d) => {
  const u = URL.createObjectURL(
    new Blob([exportText(d)], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = "foco-ensaios.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
const preset = (name: string, p: Partial<Settings>) =>
  v("button", { onclick: [Set, p] }, text(name));
function panel(s: State) {
  if (s.modal === "archive")
    return [
      v("h2", { id: "panel-title" }, text("Seu arquivo.")),
      v(
        "p",
        {},
        text(
          "Até oito ensaios guardados neste navegador. Só aparecem os que você criou.",
        ),
      ),
      s.data.shots.length
        ? v(
            "ol",
            { class: "shots" },
            s.data.shots
              .slice()
              .reverse()
              .map((shot) =>
                v("li", { key: shot.id }, [
                  v("img", {
                    src: `${import.meta.env.BASE_URL}photos/${shot.settings.scene}.webp`,
                    width: 100,
                    height: 80,
                    alt: "",
                  }),
                  v("div", {}, [
                    v(
                      "h3",
                      {},
                      text(
                        scenes.find((v) => v.id === shot.settings.scene)!.name,
                      ),
                    ),
                    v("p", {}, text(describe(shot.settings))),
                    v("p", {}, text(shot.note)),
                    v(
                      "button",
                      { onclick: [Use, shot.settings] },
                      text("Carregar ajustes ↗"),
                    ),
                    v(
                      "button",
                      { class: "remove", onclick: [Remove, shot.id] },
                      text("Remover ensaio " + shot.id),
                    ),
                  ]),
                ]),
              ),
          )
        : v(
            "p",
            { class: "empty" },
            text(
              "Ainda não há ensaios. Ajuste a luz e escolha “Guardar ensaio”.",
            ),
          ),
      v(
        "button",
        { class: "bright", onclick: (s) => [s, [Download, s.data]] },
        text("Exportar arquivo .txt ↓"),
      ),
    ];
  return [
    v("h2", { id: "panel-title" }, text("Fotografia é escolha.")),
    v(
      "p",
      {},
      text(
        "Abertura, tempo e ISO mudam juntos a exposição. Aqui a referência é f/4, 1/125 s e ISO 400. O indicador mostra a diferença em pontos de luz em relação a essa referência, não uma medição da cena.",
      ),
    ),
    v("dl", { class: "lessons" }, [
      v("dt", {}, text("Abertura")),
      v(
        "dd",
        {},
        text(
          "Um número f menor significa uma abertura maior. O desfoque periférico mostrado é ilustrativo; a foto original não ganha profundidade real.",
        ),
      ),
      v("dt", {}, text("Velocidade")),
      v(
        "dd",
        {},
        text(
          "Um tempo maior deixa entrar mais luz. A foto é fixa: não é possível recuperar ou congelar movimento que já estava no original.",
        ),
      ),
      v("dt", {}, text("ISO")),
      v(
        "dd",
        {},
        text(
          "Aumentar ISO altera o ganho do sinal. A textura sobreposta aqui é didática e não representa o ruído de um sensor específico.",
        ),
      ),
    ]),
    v(
      "p",
      {},
      text(
        "Não usamos câmera, dados pessoais, API, backend ou conta. Seus ensaios são locais, sem sincronização. O TXT é um registro legível, sem importação.",
      ),
    ),
    v("h3", {}, text("Fotografias reais e licenciadas")),
    v(
      "ul",
      { class: "credits" },
      scenes.map((scene) =>
        v(
          "li",
          {},
          v(
            "a",
            {
              href: `https://www.pexels.com/photo/${scene.source}/`,
              target: "_blank",
              rel: "noreferrer",
            },
            text(`${scene.name} · ${scene.author} ↗`),
          ),
        ),
      ),
    ),
    v(
      "a",
      {
        href: "https://www.pexels.com/legal-pages/license/",
        target: "_blank",
        rel: "noreferrer",
      },
      text("Licença Pexels ↗"),
    ),
    v(
      "p",
      {},
      text(
        "Sem imagens geradas por IA. Imagens alteradas apenas para a prévia didática. Não há vínculo com marcas de equipamento ou fotógrafos.",
      ),
    ),
  ];
}
app<State>({
  init: {
    settings: defaults(),
    data,
    modal: "",
    message: warning,
    note: "",
    compare: 100,
    grid: true,
    reference: false,
  },
  node: document.querySelector("#app")!,
  view: (s) => {
    const p = s.reference ? defaults() : s.settings,
      fx = visual(p),
      scene = scenes.find((a) => a.id === s.settings.scene)!,
      ev = exposure(s.settings);
    return v(
      "div",
      { class: ["camera", s.data.reduced ? "quiet" : ""].join(" ") },
      [
        v(
          "a",
          { class: "skip", href: "#controls" },
          text("Pular para os ajustes"),
        ),
        v("header", {}, [
          v("div", { class: "identity" }, [
            v("h1", {}, text("foco")),
            v("span", {}, text("LUZ NAS SUAS MÃOS.")),
          ]),
          v("nav", { "aria-label": "Laboratório" }, [
            v(
              "button",
              { onclick: Reduced, "aria-pressed": String(s.data.reduced) },
              text(s.data.reduced ? "Movimento reduzido" : "Reduzir movimento"),
            ),
            v(
              "button",
              { onclick: [Open, "archive"] },
              text(`Arquivo (${s.data.shots.length})`),
            ),
            v(
              "button",
              {
                onclick: [Open, "about"],
                "aria-label": "Como funciona e créditos",
              },
              text("?"),
            ),
          ]),
        ]),
        v("main", {}, [
          v(
            "section",
            {
              class: "viewfinder",
              "aria-label": "Prévia fotográfica didática",
            },
            [
              v(
                "div",
                { class: "original" },
                v("img", {
                  src: `${import.meta.env.BASE_URL}photos/${scene.id}.webp`,
                  width: 2200,
                  height: 1600,
                  alt: scene.alt,
                  fetchpriority: "high",
                }),
              ),
              v(
                "div",
                {
                  class: "simulation",
                  style: { clipPath: `inset(0 ${100 - s.compare}% 0 0)` },
                },
                [
                  v("img", {
                    class: "soft",
                    src: `${import.meta.env.BASE_URL}photos/${scene.id}.webp`,
                    alt: "",
                    style: {
                      filter: `brightness(${fx.brightness}) blur(${fx.blur}px)`,
                    },
                  }),
                  v("img", {
                    class: "focused",
                    src: `${import.meta.env.BASE_URL}photos/${scene.id}.webp`,
                    alt: "",
                    style: {
                      filter: `brightness(${fx.brightness})`,
                      clipPath: `circle(${s.settings.aperture * 2 + 8}% at ${s.settings.focus}% 50%)`,
                    },
                  }),
                  v("div", {
                    class: "grain",
                    style: { opacity: String(fx.grain) },
                  }),
                ],
              ),
              v("div", { class: "iris", "aria-hidden": "true" }),
              s.grid
                ? v("div", { class: "gridlines", "aria-hidden": "true" }, [
                    v("i", {}),
                    v("i", {}),
                    v("i", {}),
                    v("i", {}),
                  ])
                : null,
              v("div", { class: "finder-top" }, [
                v("span", {}, text("M / SIMULADOR")),
                v(
                  "span",
                  {},
                  text("FOTOGRAFIA REAL · " + scene.author.toUpperCase()),
                ),
              ]),
              v(
                "div",
                {
                  class: "focus-reticle",
                  "aria-hidden": "true",
                  style: { left: s.settings.focus + "%" },
                },
                [v("i", {}), v("span", {}, text("FOCO"))],
              ),
              v(
                "div",
                { class: "scene-choices", "aria-label": "Escolher fotografia" },
                scenes.map((a, i) =>
                  v(
                    "button",
                    {
                      "aria-pressed": String(a.id === s.settings.scene),
                      onclick: [Switch, a.id],
                    },
                    [v("span", {}, text("0" + (i + 1))), text(a.name)],
                  ),
                ),
              ),
              v("div", { class: "meter" }, [
                v("b", {}, text((ev >= 0 ? "+" : "") + ev.toFixed(1) + " EV")),
                v("span", {}, text("RELATIVO À REFERÊNCIA")),
                v(
                  "div",
                  { class: "meter-scale", "aria-hidden": "true" },
                  v("i", {
                    style: {
                      left: Math.max(0, Math.min(100, 50 + ev * 8)) + "%",
                    },
                  }),
                ),
              ]),
              v("div", { class: "finder-tools" }, [
                v(
                  "button",
                  {
                    "aria-pressed": String(s.grid),
                    onclick: (s) => ({ ...s, grid: !s.grid }),
                  },
                  text("Grade"),
                ),
                v(
                  "button",
                  {
                    "aria-pressed": String(s.reference),
                    onclick: (s) => ({ ...s, reference: !s.reference }),
                  },
                  text(s.reference ? "Voltar ao ajuste" : "Ver referência"),
                ),
              ]),
              v("label", { class: "comparison" }, [
                v(
                  "span",
                  {},
                  text(`Comparar original / ajuste · ${s.compare}% ajustado`),
                ),
                v("input", {
                  type: "range",
                  min: 0,
                  max: 100,
                  value: s.compare,
                  "aria-label": "Comparação entre original e ajuste",
                  oninput: (s, e) => ({
                    ...s,
                    compare: Number((e.target as HTMLInputElement).value),
                  }),
                }),
              ]),
            ],
          ),
          v(
            "section",
            {
              id: "controls",
              class: "controls",
              "aria-label": "Ajustes de exposição",
            },
            [
              v("div", { class: "dials" }, [
                v("label", { class: "dial" }, [
                  v("span", {}, text("01 / ABERTURA")),
                  v("strong", {}, text("ƒ/" + s.settings.aperture)),
                  v("input", {
                    type: "range",
                    min: 0,
                    max: apertures.length - 1,
                    step: 1,
                    value: apertures.indexOf(s.settings.aperture),
                    "aria-label": "Abertura do diafragma",
                    oninput: (s, e) =>
                      Set(s, {
                        aperture:
                          apertures[
                            Number((e.target as HTMLInputElement).value)
                          ],
                      }),
                  }),
                  v("small", {}, text("MAIS ABERTA ← → MAIS FECHADA")),
                ]),
                v("label", { class: "dial" }, [
                  v("span", {}, text("02 / VELOCIDADE")),
                  v("strong", {}, [
                    text("1/"),
                    v("b", {}, text(s.settings.speed)),
                  ]),
                  v("input", {
                    type: "range",
                    min: 0,
                    max: speeds.length - 1,
                    step: 1,
                    value: speeds.indexOf(s.settings.speed),
                    "aria-label": "Velocidade do obturador",
                    oninput: (s, e) =>
                      Set(s, {
                        speed:
                          speeds[Number((e.target as HTMLInputElement).value)],
                      }),
                  }),
                  v("small", {}, text("MAIS TEMPO ← → MENOS TEMPO")),
                ]),
                v("label", { class: "dial" }, [
                  v("span", {}, text("03 / ISO")),
                  v("strong", {}, text(s.settings.iso)),
                  v("input", {
                    type: "range",
                    min: 0,
                    max: isos.length - 1,
                    step: 1,
                    value: isos.indexOf(s.settings.iso),
                    "aria-label": "Sensibilidade ISO",
                    oninput: (s, e) =>
                      Set(s, {
                        iso: isos[Number((e.target as HTMLInputElement).value)],
                      }),
                  }),
                  v("small", {}, text("MENOR GANHO ← → MAIOR GANHO")),
                ]),
              ]),
              v("div", { class: "fine-controls" }, [
                v("label", {}, [
                  text("POSIÇÃO DO FOCO"),
                  v("input", {
                    type: "range",
                    min: 15,
                    max: 85,
                    step: 1,
                    value: s.settings.focus,
                    "aria-label": "Posição horizontal do foco",
                    oninput: (s, e) =>
                      Set(s, {
                        focus: Number((e.target as HTMLInputElement).value),
                      }),
                  }),
                ]),
                v("div", { class: "presets" }, [
                  text("EXPERIMENTE"),
                  preset("Separar planos", {
                    aperture: 1.8,
                    speed: 500,
                    iso: 400,
                  }),
                  preset("Mais profundidade", {
                    aperture: 11,
                    speed: 30,
                    iso: 800,
                  }),
                  preset("Restaurar referência", {
                    aperture: 4,
                    speed: 125,
                    iso: 400,
                    focus: 50,
                  }),
                ]),
              ]),
              v("div", { class: "save-row" }, [
                v("label", {}, [
                  v("span", {}, text("Uma nota para este ensaio")),
                  v("input", {
                    type: "text",
                    maxlength: 180,
                    value: s.note,
                    placeholder: "O que mudou quando você ajustou a luz?",
                    oninput: (s, e) => ({
                      ...s,
                      note: (e.target as HTMLInputElement).value.slice(0, 180),
                    }),
                  }),
                ]),
                v(
                  "button",
                  {
                    class: "shutter",
                    "aria-label": "Guardar ensaio",
                    onclick: Save,
                  },
                  v("span", {}),
                ),
                v("span", { class: "shutter-caption" }, text("GUARDAR ENSAIO")),
              ]),
              v("p", { class: "notice", role: "status" }, text(s.message)),
              v(
                "p",
                { class: "disclaimer" },
                text(
                  "PRÉVIA DIDÁTICA APROXIMADA. NÃO REPRODUZ A ÓPTICA, O MOVIMENTO OU O RUÍDO DE UMA CÂMERA REAL.",
                ),
              ),
            ],
          ),
        ]),
        v("footer", {}, [
          v("span", {}, text("FOCO / LABORATÓRIO INDEPENDENTE.")),
          v(
            "a",
            {
              href: "https://github.com/gustapaz/foco-optico",
              target: "_blank",
              rel: "noreferrer",
            },
            text("Gustavo Paz · código ↗"),
          ),
        ]),
        v(
          "dialog",
          { id: "panel", "aria-labelledby": "panel-title", oncancel: Close },
          [
            v(
              "button",
              { class: "close", "aria-label": "Fechar janela", onclick: Close },
              text("×"),
            ),
            ...panel(s),
          ],
        ),
      ],
    );
  },
});
