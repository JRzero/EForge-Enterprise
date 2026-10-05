# ADR-0015: Preserve cache diagnostics charts with pinned ECharts

Status: Accepted

Date: 2026-10-05

## Context

The immutable RuoYi frontend behavior reference includes a Redis command rose
chart and memory gauge. A text-only statistics page would omit those capabilities.
The pinned EForge public packages do not expose a chart component for these forms.

## Decision

Consume ECharts 6.1.0 as an exact package dependency. Import its public core,
PieChart, GaugeChart, TooltipComponent and SVGRenderer modules, and load the
chart component separately from the cache statistics page. Keep both EForge and
RuoYi architecture baselines unchanged. No upstream application source is copied.

Command geometry uses bounded proportions derived with BigInt; the accessible
readout and tooltips retain exact decimal call counts beyond JavaScript's safe
integer range. Zero totals do not draw synthetic equal slices. Gauge values use
Redis's exact byte reading converted to MiB, while the human-readable Redis value
remains visible. Its range expands when consumption exceeds 1000 MiB.

Use native DOM text for tooltips, confine them to the chart and wrap long text.
React also renders diagnostic values as text. Keyboard-accessible command buttons
show the same tooltips. Observe container resizing and dispose both instances
and the observer on unmount or data replacement.

## Consequences and verification

The chart library is a separate lazy bundle; cache management does not import it.
The framework stays a modular monolith and canonical DTOs/client generation stay
unchanged. Unit tests cover large counters, inert tooltips and zero values.
Browser tests cover both SVG drawings, keyboard tooltips, narrow-screen resizing,
refresh and navigation cleanup. Actual Redis/browser acceptance and exact commit
CI are recorded in the frontend parity inventory.

The public integration follows the official
[modular import documentation](https://echarts.apache.org/handbook/en/basics/import/),
[SVG renderer guidance](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
and [resize/disposal lifecycle](https://echarts.apache.org/handbook/en/concepts/chart-size/).
