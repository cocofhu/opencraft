# Browser viewport preset source review

## Bounded source declaration

The [fixed baseline](browser-viewport-presets-baseline.json) records the module's
explicit source-identical constants/helpers claim. Directory membership and
device names do not select adjacent code for replacement. Preset IDs, dimensions,
order and default state are existing application compatibility data. Retain
them; do not imply these are independently verified physical-device specifications
or remove working device choices because of their brand names.

## Requirements frozen before authoring

- Preserve all six public exports and both current consumers. Initialization
  establishes the default, responsive ID and ordered 13-entry preset catalog;
  repeated initialization retains the same object/array identities.
- Preserve the default disabled responsive state (390 by 844), the exact
  existing application preset data and ordering recorded in the baseline.
  The values are compatibility inputs; their presence alone is not a reason
  to invent different dimensions or add a new device catalog.
- Width/height helpers round to an integer and enforce current bounds (minimum
  240/160, maximum 4096). Preserve pure numeric return behavior, including the
  observed nonfinite propagation, without taking over drag capture, keyboard,
  persistence, scale or Host state.
- Review the explicitly attributed helper expression and initialization only.
  Preserve ordinary data and stable integration names. No new tests/harness,
  no neighboring manager/Host rewrite, no strict author isolation or historical
  rights clearance claim. Public declaration and black-box application outputs
  are authoring inputs; old target expressions are not printed for authoring.

## Initial public observations

Native module observation, outside the repository, records all application
values, undefined data exports before initialization, identity stability after
reinitialization and boundary/fractional/nonfinite numeric calls. The next step
is to complete the frozen public contract observations before authoring a bounded
implementation. This checkpoint contains no implementation change.
