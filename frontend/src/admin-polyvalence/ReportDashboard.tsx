import { AlertTriangle, CheckCircle2, Layers3, UsersRound } from 'lucide-react';
import type { PolyvalenceDashboard } from './types';

const heatScoreClass = (score: number) => score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 35 ? 'medium' : 'low';

export function ReportDashboard({ dashboard }: { dashboard: PolyvalenceDashboard }) {
  const deltaText = (value: number | null | undefined, unit: string) => value == null ? 'Önceki dönem karşılaştırması yok' : (value > 0 ? '+' : '') + value + ' ' + unit + ' önceki döneme göre';
  const rate = Math.min(100, Math.max(0, Number(dashboard.summary.polyvalence_rate) || 0));
  const hasTargets = dashboard.heatmap.cells.length > 0;
  return <>
    <section className="poly-report-metrics" aria-label="Yetkinlik sonuçları">
      <article className="poly-metric-violet"><UsersRound className="poly-metric-icon" aria-hidden="true" /><span>Genel polivalans oranı</span><strong>%{dashboard.summary.polyvalence_rate}</strong><small>{deltaText(dashboard.summary.polyvalence_delta, 'yüzde puan')}</small></article>
      <article className="poly-metric-teal"><Layers3 className="poly-metric-icon" aria-hidden="true" /><span>Ort. beceri / çalışan</span><strong>{dashboard.summary.average_skill_per_employee}</strong><small>{deltaText(dashboard.summary.average_skill_delta, 'beceri')}</small></article>
      <article className="poly-metric-coral"><AlertTriangle className="poly-metric-icon" aria-hidden="true" /><span>Kritik beceri riski</span><strong>{dashboard.summary.critical_risk_count}</strong><small>Asgari yetkin kişi ve yedekleme kontrolü</small></article>
    </section>
    <div className="poly-report-overview">
      <section className="poly-surface poly-surface-body"><h2>Hedef karşılama</h2><p className="poly-muted">Hedefli değerlendirmeler üzerinden</p>
        {hasTargets ? <div className="poly-donut-layout">
          <div className="poly-donut" role="img" aria-label={'Hedefi karşılayan %' + rate + ', hedefin altında veya değerlendirilmemiş %' + Number((100 - rate).toFixed(2))}>
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="poly-donut-track" cx="60" cy="60" r="48" /><circle className="poly-donut-value" cx="60" cy="60" r="48" pathLength="100" strokeDasharray={rate + ' 100'} /></svg>
            <strong>%{rate}</strong>
          </div>
          <div className="poly-donut-legend"><span><i className="poly-legend-met" />Hedefi karşılayan <b>%{rate}</b></span><span><i className="poly-legend-unmet" />Hedefin altında / değerlendirilmemiş <b>%{Number((100 - rate).toFixed(2))}</b></span></div>
        </div> : <p className="poly-empty">Hedefli değerlendirme bulunmuyor.</p>}
      </section>
      <section className="poly-surface poly-surface-body"><h2>Pozisyon karşılaştırması</h2><p className="poly-muted">Hedef seviyesine ulaşma oranı</p>
        <div className="poly-comparison-list">{dashboard.department_comparison.map(item => <article key={item.department_id}><strong>{item.name}</strong><progress className="poly-progress" max="100" value={item.score} aria-label={item.name + ' hedef karşılama oranı'} /><b>%{item.score}</b></article>)}</div>
        {!dashboard.department_comparison.length && <p className="poly-empty">Karşılaştırma verisi bulunmuyor.</p>}
      </section>
    <section className="poly-surface poly-surface-body"><h2>Operasyon ve yedekleme riskleri</h2>
      {!dashboard.operation_risks.length ? <p className="poly-notice poly-notice-success"><CheckCircle2 size={18} /> Bu kapsamda kritik beceri riski bulunmuyor.</p> : <div className="poly-risk-items">{dashboard.operation_risks.map((item, index) => <article key={index}><AlertTriangle size={18} /><div><strong>{item.skill_name}</strong><small>{item.department_name} · {item.qualified_count} yetkin kişi / en az {item.min_qualified_count}{item.owner_name ? ' · Yalnız ' + item.owner_name : ''}</small></div></article>)}</div>}
    </section>

    </div>
    <div className="poly-report-charts">
      <section className="poly-surface poly-surface-body"><h2>Pozisyon × Beceri alanı</h2><p className="poly-muted">Hücreler hedef seviyesine ulaşma yüzdesini gösterir.</p>
        <div className="poly-table-scroll" role="region" aria-label="Hedef karşılama ısı haritası" tabIndex={0}><table className="poly-data-table poly-heatmap-table"><thead><tr><th>Pozisyon</th>{dashboard.heatmap.categories.map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>
          {dashboard.heatmap.departments.map(department => <tr key={department.id}><th>{department.name}</th>{dashboard.heatmap.categories.map(category => {
            const cell = dashboard.heatmap.cells.find(item => String(item.department_id) === String(department.id) && item.category === category);
            return <td key={category} className={cell ? 'poly-heat-' + heatScoreClass(cell.score) : ''}>{cell ? '%' + cell.score : '—'}</td>;
          })}</tr>)}
        </tbody></table></div>
        <div className="poly-heat-legend"><span className="poly-heat-low">%0–34</span><span className="poly-heat-medium">%35–59</span><span className="poly-heat-good">%60–79</span><span className="poly-heat-strong">%80–100</span><span>— Veri yok</span></div>
        {!dashboard.heatmap.departments.length && <p className="poly-empty">Hedefli değerlendirme bulunmuyor.</p>}
      </section>
      <section className="poly-surface poly-surface-body"><h2>Hedefi karşılayan beceri sayısına göre ilk çalışanlar</h2>
        <div className="poly-ranking-list">{dashboard.top_employees.map((item, index) => <article key={item.employee_id + '-' + index}><b className="poly-avatar" aria-label={(index + 1) + ". sırada"}>{item.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</b><div><strong>{item.name}</strong><small>{item.position} · {item.department_name}</small></div><span className="poly-ranking-score">{item.completed}/{item.target_total} hedef<progress className="poly-progress" max={Math.max(1, item.target_total)} value={item.completed} aria-label={item.name + ' hedef karşılama'} /></span></article>)}</div>
        {!dashboard.top_employees.length && <p className="poly-empty">Çalışan sonucu bulunmuyor.</p>}
      </section>
    </div>
    <div className="poly-report-development">
      <section className="poly-surface poly-surface-body"><h2>Gelişim gereken beceriler</h2><p className="poly-muted">Hedef karşılama oranı %60'ın altında olan ilk beş beceri.</p>
        <div className="poly-comparison-list">{dashboard.development_skills.map((item, index) => <article key={index}><strong>{item.skill_name}<small>{item.department_name} · {item.category}</small></strong><progress className="poly-progress" max="100" value={item.coverage} aria-label={item.skill_name + ' kapsam oranı'} /><b>%{item.coverage}</b></article>)}</div>
        {!dashboard.development_skills.length && <p className="poly-empty">Bu eşik altında gelişim açığı bulunmuyor.</p>}
      </section>
    </div>
  </>;
}
