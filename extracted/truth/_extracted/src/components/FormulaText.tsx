// @cleanroom-component: FormulaText
// @domain: math-content-rendering
// @slot: shared/formula-safe-display
// @depends: CSS classNamePrefix, boardSticker/mathBoardText
// @io-input: raw text children
// @io-output: formula-safe text display
// @boundary: display only; never normalizes text before TTS or asset storage

import type { HTMLAttributes, ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { hasBoardMath, tokenizeBoardText } from '../modules/boardSticker';

type FormulaTextElement = 'div' | 'p' | 'span';

export type FormulaTextProps = HTMLAttributes<HTMLElement> & {
  as?: FormulaTextElement;
  children: ReactNode;
  classNamePrefix?: string;
  rootClassName?: string;
};

export function FormulaText({
  as = 'span',
  children,
  className,
  classNamePrefix = 'math-text',
  rootClassName = classNamePrefix,
  ...restProps
}: FormulaTextProps) {
  const mergedClassName = [rootClassName, className].filter(Boolean).join(' ');
  const renderedChildren = typeof children === 'string' && hasBoardMath(children) ? (
    <span className={`${classNamePrefix}__rich`} aria-label={children}>
      {tokenizeBoardText(children).map((line, lineIndex) => (
        <span className={`${classNamePrefix}__line`} key={`${lineIndex}-${line.map((token) => token.kind).join('-')}`}>
          {line.map((token, tokenIndex) => {
            if (token.kind === 'text') {
              return (
                <span className={`${classNamePrefix}__text-run`} key={`${lineIndex}-${tokenIndex}`}>
                  {token.text}
                </span>
              );
            }

            return (
              <span
                className={`${classNamePrefix}__math-run`}
                dangerouslySetInnerHTML={{ __html: renderLatex(token.latex) }}
                key={`${lineIndex}-${tokenIndex}`}
              />
            );
          })}
        </span>
      ))}
    </span>
  ) : (
    children
  );

  if (as === 'div') {
    return (
      <div className={mergedClassName} {...(restProps as HTMLAttributes<HTMLDivElement>)}>
        {renderedChildren}
      </div>
    );
  }

  if (as === 'p') {
    return (
      <p className={mergedClassName} {...(restProps as HTMLAttributes<HTMLParagraphElement>)}>
        {renderedChildren}
      </p>
    );
  }

  return (
    <span className={mergedClassName} {...(restProps as HTMLAttributes<HTMLSpanElement>)}>
      {renderedChildren}
    </span>
  );
}

function renderLatex(latex: string) {
  return katex.renderToString(latex, {
    displayMode: false,
    output: 'html',
    strict: false,
    throwOnError: false,
    trust: false,
  });
}
