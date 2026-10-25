"use client";
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, post } from '@/lib/client-api';
import type { Resource } from '@/lib/contracts';
import './platform.css';
type Question = {
    q: string;
    type: 'radio' | 'check' | 'text';
    options: string[];
    optional: boolean;
};
type Answer = {
    selected: number[];
    custom: string;
    skipped: boolean;
};
export default function BriefCard({ resource, onSaved, onContinue }: {
    resource: Resource;
    onSaved: (resource: Resource) => void;
    onContinue: () => void;
}) {
    const questions = resource.data.questions as Question[], [index, setIndex] = useState(0), [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => ({ selected: [], custom: '', skipped: false }))), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const question = questions[index], answer = answers[index], last = index === questions.length - 1, valid = answer.selected.length > 0 || !!answer.custom.trim();
    const change = (value: Partial<Answer>) => setAnswers(current => current.map((a, i) => i === index ? { ...a, ...value, skipped: false } : a));
    const next = async (skip = false) => { const final = answers.map((a, i) => i === index ? { ...a, skipped: skip } : a); setAnswers(final); if (!last) {
        setIndex(i => i + 1);
        return;
    } setBusy(true); try {
        onSaved(await api<Resource>('/api/brief/' + resource.id, post({ version: resource.version, answers: final })));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Les réponses restent dans cette carte. Réessayez.');
    }
    finally {
        setBusy(false);
    } };
    if (resource.status !== 'waiting_input')
        return <div><p className="platform-notice">Les réponses à ce brief sont enregistrées. Aucun accord de dépense ou de publication n’a été donné.</p><button type="button" className="platform-button primary" onClick={onContinue}>Continuer avec ces réponses</button></div>;
    return <section className="brief-card" aria-label="Préciser le brief"><p>{String(resource.data.summary || '')}</p><fieldset disabled={busy}><legend>{question.q}{question.optional ? ' (facultatif)' : ''}</legend>{question.options.map((option, i) => <label className="platform-check" key={i}><input type={question.type === 'check' ? 'checkbox' : 'radio'} name={'brief-' + resource.id} checked={answer.selected.includes(i)} onChange={() => change({ selected: question.type === 'radio' ? [i] : answer.selected.includes(i) ? answer.selected.filter(n => n !== i) : [...answer.selected, i] })}/>{option}</label>)}<label className="platform-field">{question.type === 'text' ? 'Votre réponse' : 'Préciser ou proposer autre chose'}<textarea rows={3} value={answer.custom} onChange={e => change({ custom: e.target.value })} maxLength={3000}/></label></fieldset>{error && <p role="alert">{error}</p>}<footer className="platform-actions"><button type="button" className="platform-button quiet" disabled={!index || busy} aria-label="Question précédente" onClick={() => setIndex(i => i - 1)}><ChevronLeft size={16}/></button><span aria-live="polite">{index + 1} / {questions.length}</span>{question.optional && <button type="button" className="platform-button quiet" disabled={busy} onClick={() => void next(true)}>Passer</button>}<button type="button" className="platform-button primary" disabled={busy || !valid} onClick={() => void next()}>{busy ? 'Enregistrement…' : last ? 'Enregistrer les réponses' : 'Continuer'}{!last && <ChevronRight size={16}/>}</button></footer><p className="platform-muted">Ce brief ne donne aucun accord de dépense ou de publication.</p></section>;
}
