# Диаграммы дипломной работы

Исходники диаграмм. Часть на **PlantUML** (`.puml`), часть на **Mermaid** (`.mmd`),
BPMN и ГОСТ-блок-схемы — в **draw.io**.

## Список

| # | Файл | Нотация | Назначение | Статус |
|---|------|---------|------------|--------|
| 1 | `01-bpmn-process.bpmn` | BPMN 2.0 (строгий: пул, дорожки, XOR-шлюзы, события) | Существующий (ручной) процесс организации турнира в ООО «Падел-Про» (as-is) | готово |
| 1′ | `01-bpmn-process.mmd` | BPMN-приближение (Mermaid) | то же, запасной вариант | готово* |
| 1″ | `01-bpmn-process-app.bpmn` | BPMN 2.0 (строгий) | Целевой процесс в разрабатываемой системе («как стало», опционально) | готово |
| 2 | `02-arhitektura.puml` | UML component | Слои системы: UI, Server Actions, валидация, авторизация, сервисы, Prisma, SQLite | готово |
| 3 | `03-obrabotka-zapisi.puml` | UML sequence | Обработка действия записи (ввод результата матча) | готово |
| 4 | `04-chtenie-i-otobrazhenie.puml` | UML sequence | Чтение и отображение данных о турнире | готово |
| 5a | `05a-erd-playoff.puml` | ERD (Crow's Foot) | Инфологическая модель — подсистема плей-офф (пары) | готово |
| 5b | `05b-erd-round.puml` | ERD (Crow's Foot) | Инфологическая модель — подсистема круговых форматов | готово |
| 6a | `06a-erd-datalog-playoff.puml` | ERD (реляционная, PK/FK, типы) | Даталогическая — подсистема плей-офф | готово |
| 6b | `06b-erd-datalog-round.puml` | ERD (реляционная, PK/FK, типы) | Даталогическая — подсистема круговых форматов | готово |
| 7 | `07-algoritm-zapuska.drawio` | Блок-схема ГОСТ 19.701 (овалы, прямоугольники, ромбы) | Общий алгоритм запуска турнира | готово |
| 7′ | `07-algoritm-zapuska.puml` | UML activity (не ГОСТ) | то же, запасной вариант | готово* |

\* Строки `1′` и `7′` — запасные варианты (Mermaid / PlantUML, не строгая нотация).
Строка `1″` — целевой процесс в разрабатываемой системе (не основной рисунок 1).
Основные — строгие: №1 в BPMN 2.0 (`.bpmn`, теперь as-is ручной процесс),
№7 в ГОСТ-блок-схеме (`.drawio`).

> `01.svg` — рендер as-is BPMN. После правки `01-bpmn-process.bpmn` перегенерировать:
> [demo.bpmn.io](https://demo.bpmn.io) → экспорт SVG → заменить `01.svg`.

## Как рендерить

**PlantUML (`.puml`):**
- Онлайн: [planttext.com](https://www.planttext.com) или
  [plantuml.com/plantuml](https://www.plantuml.com/plantuml) — вставить текст файла.
- VS Code: расширение *PlantUML* (jebbs), превью `Alt+D`.
- Экспорт: PNG (растр) или SVG (масштаб без потерь) → вставка в Word.

**BPMN (`.bpmn`):**
- Открыть/править: [demo.bpmn.io](https://demo.bpmn.io) → перетащить файл (или File → Open).
- Экспорт PNG/SVG — кнопка на правой панели.

**draw.io (`.drawio`):**
- Открыть/править: [app.diagrams.net](https://app.diagrams.net) → File → Open.
- Экспорт: File → Export as → PNG/SVG.

**Mermaid (`.mmd`):**
- Онлайн: [mermaid.live](https://mermaid.live) — вставить текст, экспорт PNG/SVG.
- VS Code: расширение *Mermaid Preview*.

Подписи на русском.
