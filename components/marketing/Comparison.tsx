import { COMPARISON } from "@/lib/landing/config";
import { FigureCaption, Section } from "./Section";

export function Comparison() {
  return (
    <Section
      id="compare"
      num="009"
      kicker={COMPARISON.kicker}
      title={COMPARISON.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          A marketplace gives you reach. It also gives you their rules, their commission and their copy of your
          customer. Here is the honest difference.
        </p>
      }
    >
      <figure className="ae-reveal">
        <div
          tabIndex={0}
          role="region"
          aria-label="Comparison table, scrollable"
          className="overflow-x-auto rounded-[var(--ae-radius)] border border-[var(--ae-line)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ae-amber)]"
        >
          <table className="ae-table w-full min-w-[42rem] border-collapse">
            <caption className="sr-only">Comparison between ordering through an aggregator and owning your own direct ordering channel</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[26%]">
                  Topic
                </th>
                <th scope="col" className="w-[37%]">
                  Through an aggregator
                </th>
                <th scope="col" className="w-[37%]">
                  With your own channel
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.rows.map((row) => (
                <tr key={row.topic}>
                  <th scope="row">{row.topic}</th>
                  <td className="text-[0.9rem] leading-relaxed text-[var(--ae-dim)]">{row.aggregator}</td>
                  <td className="text-[0.9rem] leading-relaxed text-[var(--ae-muted)]">
                    <span className="mr-2 inline-block size-1.5 rounded-full bg-[var(--ae-amber)] align-middle" aria-hidden />
                    {row.direct}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <FigureCaption>
          <span className="text-[var(--ae-amber)]">Figure 3</span>
          <span>{COMPARISON.caption}</span>
        </FigureCaption>
      </figure>
    </Section>
  );
}
