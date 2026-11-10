/* Guest-facing error wording. Keep diagnostic details in the console. */
(function(){
 'use strict';
 const messages={
  invalid_credentials:'Courriel ou mot de passe incorrect. Vérifie tes informations ou utilise « Mot de passe oublié ? ».',
  email_not_confirmed:'Confirme ton courriel avant de te connecter. Vérifie aussi tes courriels indésirables.',
  email_exists:'Un compte utilise déjà ce courriel. Connecte-toi ou utilise « Mot de passe oublié ? ».',
  user_already_exists:'Un compte utilise déjà ce courriel. Connecte-toi ou utilise « Mot de passe oublié ? ».',
  email_address_invalid:'Cette adresse courriel n’est pas acceptée. Vérifie-la ou utilise une autre adresse.',
  weak_password:'Choisis un mot de passe plus long et moins courant, avec au moins 8 caractères.',
  same_password:'Choisis un mot de passe différent de ton mot de passe actuel.',
  otp_expired:'Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien depuis Mon profil.',
  over_email_send_rate_limit:'Trop de courriels ont été demandés. Patiente quelques minutes avant de réessayer.',
  over_request_rate_limit:'Trop de tentatives rapprochées. Patiente un peu avant de réessayer.',
  anonymous_provider_disabled:'Les demandes sans compte sont momentanément indisponibles. Préviens le MC.'
 };
 const expired=new Set(['session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used','bad_jwt','flow_state_expired','flow_state_not_found']);
 window.yargErrorMessage=function(error,fallback){
  console.error('Action YARG impossible :',error);
  const code=String(error?.code||'');
  const name=String(error?.name||'');
  const text=String(error?.message||'');
  if(Object.prototype.hasOwnProperty.call(messages,code))return messages[code];
  if(expired.has(code)||name==='AuthSessionMissingError'||error?.status===401)
   return 'Ta connexion a expiré. Reconnecte-toi dans Mon profil, puis réessaie.';
  if(error?.status===429)return messages.over_request_rate_limit;
  if(name==='NotAllowedError'||/notifications non autorisées|permission.*denied/i.test(text))
   return 'Autorise les notifications pour ce site dans les réglages de ton navigateur, puis réessaie.';
  if(name==='NotSupportedError'||/Web Push n’est pas disponible/i.test(text))
   return 'Ce navigateur ne permet pas les notifications. Sur iPhone, ouvre le site depuis son icône sur l’écran d’accueil.';
  if(/Connecte-toi à un compte Rockstar/i.test(text))
   return 'Connecte-toi dans Mon profil avant d’activer les notifications.';
  if(/invalid login credentials/i.test(text))return messages.invalid_credentials;
  if(/error sending.*email|error sending.*mail/i.test(text))
   return 'Le courriel n’a pas pu être envoyé. Réessaie plus tard; si le problème persiste, préviens Jak.';
  if(/failed to fetch|fetch failed|networkerror|network request failed|load failed|timed? ?out/i.test(text))
   return 'Vérifie ta connexion Internet, puis réessaie.';
  if(/(?:chanson|song).*(?:déjà|already).*(?:demand|jou|request|play)/i.test(text))
   return 'Cette chanson est déjà demandée ou jouée ce soir. Choisis-en une autre.';
  if(/(?:soirée|party|demandes|requests).*(?:ferm|closed|désactiv|disabled|inactive|not active)/i.test(text))
   return 'Les demandes sont fermées pour le moment. Consulte le MC pour savoir quand elles ouvriront.';
  if(/(?:guitare|instrument|microphone).*(?:réserv|reserved|occup|unavailable)/i.test(text))
   return 'Cette place vient d’être réservée. Choisis-en une autre ou actualise la file.';
  if(/(?:groupe|band).*(?:complet|full)/i.test(text))
   return 'Ce groupe est complet. Actualise la file pour trouver une autre place.';
  return fallback||'Cette action est momentanément indisponible. Réessaie dans un instant.';
 };
})();
