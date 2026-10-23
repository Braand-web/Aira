'use client';

import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { BRIEF_LIMITS, formatBriefAnswers, type BriefAnswers, type BriefQuestionnaire } from '@/lib/brief-questions';
import './brief-question-card.css';

export type BriefQuestionCardProps = {
  questionnaire: BriefQuestionnaire;
  onUseAnswers: (text: string) => void;
  disabled?: boolean;
};

const AUTO_ADVANCE_MS = 480;
const EMPTY_ANSWER = { selected: [] as string[], custom: '' };

/** A new questionnaire resets only the card's local, unsent answers. */
export function BriefQuestionCard(props: BriefQuestionCardProps) {
  const questionnaire = props.questionnaire;
  if (!questionnaire || typeof questionnaire.title !== 'string' || !Array.isArray(questionnaire.questions)
    || !questionnaire.questions.length || questionnaire.questions.length > BRIEF_LIMITS.questions
    || questionnaire.questions.some(question => !question || typeof question.id !== 'string' || !question.id
      || typeof question.q !== 'string' || !question.q.trim() || !['radio', 'check'].includes(question.type)
      || !Array.isArray(question.options) || !question.options.length || question.options.length > BRIEF_LIMITS.options
      || question.options.some(option => typeof option !== 'string' || !option.trim())
      || new Set(question.options).size !== question.options.length)
    || new Set(questionnaire.questions.map(question => question.id)).size !== questionnaire.questions.length) return null;
  const key = JSON.stringify([questionnaire.title, questionnaire.questions.map(({ id, q, type, options }) => [id, q, type, options])]);
  return <BriefQuestionCardContent key={key} {...props} />;
}

function BriefQuestionCardContent({ questionnaire, onUseAnswers, disabled = false }: BriefQuestionCardProps) {
  const baseId = useId();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(0);
  const [answers, setAnswers] = useState<BriefAnswers>({});
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [height, setHeight] = useState<number>();
  const questionContent = useRef<HTMLDivElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const reopenButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef(false);
  const applied = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const question = questionnaire.questions[questionIndex];
  const last = questionIndex === questionnaire.questions.length - 1;
  const answer = Object.hasOwn(answers, question.id) ? answers[question.id] : EMPTY_ANSWER;
  const hasAnswer = answer.selected.length > 0 || Boolean(answer.custom.trim());
  const hasAnyAnswer = Object.values(answers).some(item => item.selected.length > 0 || Boolean(item.custom.trim()));
  const direction = questionIndex < previousIndex ? 'previous' : 'next';

  function cancelAdvance() {
    clearTimeout(timer.current);
    timer.current = undefined;
  }

  useLayoutEffect(() => {
    // Synchronize the timer with externally disabled controls before it can run.
    if (disabled || !open || submitted) clearTimeout(timer.current);
    return () => clearTimeout(timer.current);
  }, [disabled, open, submitted]);

  useLayoutEffect(() => {
    if (!open) {
      reopenButton.current?.focus({ preventScroll: true });
      return;
    }
    if (submitted || !pendingFocus.current || disabled) return;
    pendingFocus.current = false;
    firstOption.current?.focus({ preventScroll: true });
  }, [questionIndex, open, submitted, disabled]);

  useEffect(() => {
    const content = questionContent.current;
    if (!content) return;
    const measure = () => setHeight(content.getBoundingClientRect().height);
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, submitted]);

  function goTo(next: number) {
    cancelAdvance();
    if (disabled) return;
    const clamped = Math.max(0, Math.min(next, questionnaire.questions.length - 1));
    if (clamped === questionIndex) return;
    pendingFocus.current = true;
    setPreviousIndex(questionIndex);
    setQuestionIndex(clamped);
  }

  function choose(option: string) {
    cancelAdvance();
    if (disabled) return;
    const selected = question.type === 'radio' ? [option]
      : answer.selected.includes(option) ? answer.selected.filter(value => value !== option) : [...answer.selected, option];
    setAnswers({ ...answers, [question.id]: { selected, custom: question.type === 'radio' ? '' : answer.custom } });
    setError('');
    // A last radio choice waits for the explicit button; it never submits itself.
    if (question.type === 'radio' && !last) timer.current = setTimeout(() => goTo(questionIndex + 1), AUTO_ADVANCE_MS);
  }

  function changeCustom(value: string) {
    cancelAdvance();
    if (disabled) return;
    const custom = value.slice(0, BRIEF_LIMITS.custom);
    setAnswers({ ...answers, [question.id]: { selected: question.type === 'radio' && custom.trim() ? [] : answer.selected, custom } });
    setError('');
  }

  function close() {
    cancelAdvance();
    setOpen(false);
  }

  function reset() {
    cancelAdvance();
    if (disabled) return;
    applied.current = false;
    setAnswers({});
    setPreviousIndex(questionIndex);
    setQuestionIndex(0);
    setSubmitted(false);
    setError('');
    pendingFocus.current = true;
    // When resetting the first question, its index does not cause a new effect.
    firstOption.current?.focus({ preventScroll: true });
  }

  function useAnswers() {
    cancelAdvance();
    if (disabled || !hasAnyAnswer || applied.current) return;
    applied.current = true;
    try {
      onUseAnswers(formatBriefAnswers(questionnaire, answers));
      setSubmitted(true);
      setError('');
    } catch {
      applied.current = false;
      setError('Impossible de préparer le brouillon. Réessayez.');
    }
  }

  if (!open) return <div data-slot="brief-question-card" data-state="hidden">
    <button ref={reopenButton} type="button" className="brief-card-reopen" onClick={() => {
      pendingFocus.current = true;
      setOpen(true);
    }}>Reprendre les questions</button>
  </div>;

  if (submitted) return <section data-slot="brief-question-card" data-state="submitted" className="brief-card-complete" aria-label={questionnaire.title}>
    <p role="status"><Check aria-hidden="true" /> Réponses ajoutées au brouillon</p>
    <p>Relisez votre demande avant de l’envoyer.</p>
    <button type="button" className="brief-card-text-action" disabled={disabled} onClick={reset}>Recommencer</button>
  </section>;

  return <section data-slot="brief-question-card" data-state="active" className="brief-card" aria-labelledby={`${baseId}-title`} aria-describedby={`${baseId}-notice`}>
    <header className="brief-card-header">
      <h3 id={`${baseId}-title`}>{questionnaire.title}</h3>
      <div className="brief-card-header-actions">
        <button type="button" className="brief-card-icon-action" aria-label="Recommencer" title="Recommencer" disabled={disabled || !hasAnyAnswer} onClick={reset}><RotateCcw aria-hidden="true" /></button>
        <button type="button" className="brief-card-icon-action" aria-label="Fermer les questions" title="Fermer les questions" onClick={close}><X aria-hidden="true" /></button>
      </div>
    </header>
    <div className="brief-card-viewport" style={{ height }}>
      <div className="brief-card-content" ref={questionContent}>
        <fieldset key={question.id} className="brief-card-question" data-direction={direction} disabled={disabled}>
          <legend id={`${baseId}-question`}>{question.q}</legend>
          <p id={`${baseId}-hint`} className="brief-card-choice-hint">{question.type === 'check' ? 'Plusieurs choix possibles' : 'Un seul choix'}</p>
          <div className="brief-card-options" aria-describedby={`${baseId}-hint`}>
            {question.options.map((option, index) => <label key={option} className="brief-card-option">
              <input ref={index === 0 ? firstOption : undefined} type={question.type === 'radio' ? 'radio' : 'checkbox'} name={`${baseId}-${question.id}`} checked={answer.selected.includes(option)} onChange={() => choose(option)} />
              <span>{option}</span>
            </label>)}
          </div>
          <label className="brief-card-custom">
            <span>Autre réponse</span>
            <input type="text" maxLength={BRIEF_LIMITS.custom} value={answer.custom} onChange={event => changeCustom(event.target.value)} placeholder="Précisez votre réponse…" onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (!hasAnswer) return;
              if (last) applyButton.current?.focus();
              else goTo(questionIndex + 1);
            }} />
          </label>
        </fieldset>
      </div>
    </div>
    <footer className="brief-card-footer">
      <div className="brief-card-steps">
        <button type="button" className="brief-card-icon-action" aria-label="Question précédente" disabled={disabled || questionIndex === 0} onClick={() => goTo(questionIndex - 1)}><ChevronLeft aria-hidden="true" /></button>
        <span className="brief-card-step-announcement" aria-live="polite" aria-atomic="true">Question {questionIndex + 1} sur {questionnaire.questions.length}</span>
        <span className="brief-card-counter" aria-hidden="true">
          <span key={`${previousIndex}-${questionIndex}`} className="brief-card-rolling" data-direction={direction}>
            {previousIndex !== questionIndex && <span className="brief-card-rolling-old">{previousIndex + 1}</span>}
            <span className={previousIndex === questionIndex ? undefined : 'brief-card-rolling-new'}>{questionIndex + 1}</span>
          </span>
          <span> / {questionnaire.questions.length}</span>
        </span>
        <button type="button" className="brief-card-icon-action" aria-label="Question suivante" disabled={disabled || last} onClick={() => goTo(questionIndex + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="brief-card-footer-actions">
        <button type="button" className="brief-card-text-action" disabled={disabled} onClick={() => last ? close() : goTo(questionIndex + 1)}>Passer</button>
        {last ? <button ref={applyButton} type="button" className="brief-card-primary" disabled={disabled || !hasAnyAnswer} onClick={useAnswers}>Utiliser ces réponses</button>
          : <button type="button" className="brief-card-primary" disabled={disabled || !hasAnswer} onClick={() => goTo(questionIndex + 1)}>Continuer</button>}
      </div>
    </footer>
    <p className="brief-card-notice" id={`${baseId}-notice`}>Ces réponses préparent votre brouillon.</p>
    {error && <p className="brief-card-error" role="alert">{error}</p>}
  </section>;
}

export default BriefQuestionCard;
