import test from 'node:test';
import assert from 'node:assert/strict';
import {userFacingError} from '../lib/user-facing-errors.ts';

test('Technical service errors become useful product messages without naming suppliers',()=>{
 for(const input of ['SasPay est indisponible. La commande reste enregistrée.','Ajoutez OPENROUTER_API_KEY','Ajoutez la clé Anthropic','fal.ai indisponible','Configurez COMPOSIO_API_KEY','Le modèle requis et son tarif doivent être configurés.','Le tarif exact du modèle et le taux de change doivent être vérifiés.']) {
  const output=userFacingError(new Error(input));
  assert.doesNotMatch(output,/saspay|openrouter|anthropic|fal\.ai|composio|api_key/i);
  assert.match(output,/indisponible/);
 }
 assert.match(userFacingError('SasPay est indisponible. La commande reste enregistrée.'),/commande reste enregistrée/);
 assert.match(userFacingError('OpenRouter est indisponible'),/brouillon est conservé/);
});
test('Specific user errors, account identities and error objects are preserved',()=>{
 for(const text of ['Accès à cet espace non autorisé.','Connexion Meta expirée.','Gmail : autorisation refusée.','Fichier introuvable.'])assert.equal(userFacingError(new Error(text)),text);
 const error=Object.assign(new Error('Composio indisponible'),{status:503,code:'connector_unavailable'});
 userFacingError(error);assert.equal(error.message,'Composio indisponible');assert.equal(error.status,503);assert.equal(error.code,'connector_unavailable');
 assert.equal(userFacingError(null,'Réessayez.'),'Réessayez.');
});
