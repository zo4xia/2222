// @cleanroom-component: MathText
// @domain: math-content-rendering
// @slot: shared/math-safe-display
// @depends: FormulaText, CSS .math-text
// @io-input: raw text children
// @io-output: math-safe text display
// @boundary: display only; never normalizes text before TTS or asset storage

import { FormulaText, type FormulaTextProps } from './FormulaText';

export function MathText(props: FormulaTextProps) {
  return <FormulaText {...props} classNamePrefix="math-text" />;
}
