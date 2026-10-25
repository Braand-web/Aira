"use client";
import { useEffect, useState } from 'react';
import { api, post } from '@/lib/client-api';
import { NETWORK_LABELS, type SocialAccountDTO } from '@/lib/platform-contracts';
import './platform.css';
type Insight = {
    id: string;
    accountId: string;
    accountLabel: string;
    network: keyof typeof NETWORK_LABELS;
    postId: string | null;
    periodStart: number;
    periodEnd: number;
    metrics: Record<string, number>;
    fetchedAt: number;
};
const labels: Record<string, string> = { impressions: 'Impressions', reach: 'Portée', likes: 'J’aime', comments: 'Commentaires', shares: 'Partages', saves: 'Enregistrements', views: 'Vues', clicks: 'Clics', watchSeconds: 'Visionnage (secondes)' };
export default function OrganicInsights({ ready, onAsk }: {
    ready: boolean;
    onAsk: (text: string) => void;
}) {
    const [items, setItems] = useState<Insight[]>([]), [accounts, setAccounts] = useState<SocialAccountDTO[]>([]), [accountId, setAccountId] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    useEffect(() => { if (!ready)
        return; const controller = new AbortController(); void Promise.all([api<{
            items: Insight[];
        }>('/api/social/insights', { signal: controller.signal }), api<{
            accounts: SocialAccountDTO[];
        }>('/api/social/accounts', { signal: controller.signal })]).then(([result, connections]) => { setItems(result.items); setAccounts(connections.accounts); setError(''); }).catch(() => { if (!controller.signal.aborted)
        setError('Les relevés organiques ne sont pas disponibles.'); }); return () => controller.abort(); }, [ready, revision]);
    const rows = items.filter(item => !accountId || item.accountId === accountId).slice(0, 100), latest = rows.reduce((max, item) => Math.max(max, item.fetchedAt), 0);
    const sync = async () => { if (!accountId || busy)
        return; setBusy(true); try {
        await api('/api/social/insights', post({ accountId, start: Date.now() - 30 * 86400000, end: Date.now() }));
        setRevision(n => n + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Actualisation indisponible.');
    }
    finally {
        setBusy(false);
    } };
    return <section className="platform-organic" aria-labelledby="organic-title"><div className="platform-heading"><div><h2 id="organic-title">Contenus organiques</h2><p>Des relevés distincts de vos campagnes publicitaires.</p></div></div>{error && <p role="alert" className="platform-notice error">{error}</p>}
 <div className="platform-actions"><label className="platform-field">Compte<select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Tous les comptes</option>{accounts.map(account => <option key={account.id} value={account.id}>{NETWORK_LABELS[account.network]} · {account.label}</option>)}</select></label>{accountId && accounts.find(a => a.id === accountId)?.capabilities.insights && <button type="button" className="platform-button" disabled={busy} onClick={() => void sync()}>Actualiser les 30 derniers jours</button>}</div>
 {rows.length ? <><p className="platform-muted">Dernier relevé : {new Date(latest).toLocaleString('fr-FR')}. Les périodes et comptes ne sont pas additionnés pour éviter les doubles comptes.</p><div className="platform-table-scroll"><table><caption>Indicateurs disponibles par contenu et période</caption><thead><tr><th scope="col">Compte et contenu</th><th scope="col">Période</th><th scope="col">Indicateurs</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><th scope="row">{item.accountLabel}<small>{NETWORK_LABELS[item.network]} · {item.postId || 'Compte'}</small></th><td>{new Date(item.periodStart).toLocaleDateString('fr-FR')} – {new Date(item.periodEnd).toLocaleDateString('fr-FR')}</td><td>{Object.entries(labels).filter(([key]) => typeof item.metrics[key] === 'number').map(([key, label]) => <span className="organic-metric" key={key}>{label} : <strong>{item.metrics[key].toLocaleString('fr-FR')}</strong></span>)}</td></tr>)}</tbody></table></div><button type="button" className="platform-button" onClick={() => onAsk('Analyse ces relevés organiques confirmés en distinguant observations mesurées, hypothèses et actions à tester. Ne suppose pas de ventes ni de causalité. Données : ' + JSON.stringify(rows))}>Préparer une analyse</button></> : <p className="platform-empty">Aucun relevé organique disponible. Connectez un compte disposant de l’accès aux statistiques, puis lancez une synchronisation.</p>}
 <p className="platform-muted">Une métrique absente est indisponible. Les clics et interactions ne sont pas des ventes confirmées.</p></section>;
}
