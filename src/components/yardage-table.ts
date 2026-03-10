import { YARDAGE_TABLE } from '@/utils/yardage';

class YardageTable extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = this._render();
    this.querySelector('.yardage-print-btn')
      ?.addEventListener('click', () => {
        document.body.classList.add('print-yardage');
        window.print();
        window.addEventListener('afterprint', () => {
          document.body.classList.remove('print-yardage');
        }, { once: true });
      });
  }

  private _render(): string {
    const rows = YARDAGE_TABLE.map(r =>
      `<tr>
        <td>${r.min.toFixed(2)} – ${r.max.toFixed(2)}</td>
        <td>${r.yards} yards</td>
      </tr>`
    ).join('');

    return `
      <section class="yardage-section">
        <div class="yardage-controls">
          <h2 class="yardage-heading">Yardage Table</h2>
          <button class="btn-primary yardage-print-btn">Print Yardage Table</button>
        </div>
        <div class="yardage-card">
          <div class="scoresheet-print-header">
            <h1 class="scoresheet-league-title">Central Illinois Trap League</h1>
            <p class="scoresheet-week-label">Yardage Table</p>
          </div>
          <p class="yardage-instructions">
            Total the going-in averages of all <strong>5 shooters</strong> participating for the
            evening, then use the chart below to determine your starting yardage.
          </p>
          <table class="yardage-table">
            <thead>
              <tr><th>5-Shooter Total</th><th>Starting Yardage</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="scoresheet-print-footer">
            <p>Central Illinois Trap League is an independently organized, non-discriminating shooting
            sport. We encourage families and friends to participate. We remind everyone to keep it legal
            by shooting with an adult if under age, or otherwise having a valid FOID card.</p>
          </div>
        </div>
      </section>`;
  }
}

customElements.define('yardage-table', YardageTable);
