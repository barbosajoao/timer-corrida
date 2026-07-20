// keep-config.js — configuração PÚBLICA do Firebase para a funcionalidade Keep.
//
// >>> ESTE ARQUIVO NÃO CONTÉM SEGREDOS. <<<
// A "apiKey" do Firebase NÃO é uma senha: ela apenas identifica o projeto e
// pode ficar no código público (é assim que o Firebase foi desenhado). Quem
// protege seus dados são: (1) as regras do Firestore travadas no seu UID e
// (2) a criptografia E2E (keep-crypto.js). Sua senha de login e sua senha de
// criptografia NUNCA ficam aqui nem em lugar nenhum do repositório.
//
// ============================ O QUE VOCÊ PRECISA FAZER ============================
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Adicione um "App Web" (</>) ao projeto e copie o objeto de config gerado
//    para dentro de `firebaseConfig` abaixo (substitua os placeholders).
// 3. Em Authentication > Sign-in method, ative "E-mail/senha".
//    Em Authentication > Users, crie a SUA única conta (e-mail + senha FORTE).
//    Copie o "User UID" dessa conta e cole em OWNER_UID abaixo.
// 4. Em Firestore Database, crie o banco (modo produção) e publique as regras
//    do arquivo `firestore.rules` (troque OWNER_UID_AQUI pelo seu UID lá também).
// 5. (Opcional, recomendado) Ative o App Check com reCAPTCHA v3 e cole a site key
//    em RECAPTCHA_SITE_KEY abaixo. Deixe string vazia para desativar.
// Veja o passo a passo detalhado no README (seção "Notas ocultas — segurança").
// ==================================================================================

// Config pública do seu projeto (cole a do console aqui):
export const firebaseConfig = {
  apiKey: "AIzaSyAnrVcQBVgsYL-w_FhU_8Haa59SXeh_43g",
  authDomain: "timer-corrida-notas.firebaseapp.com",
  projectId: "timer-corrida-notas",
  storageBucket: "timer-corrida-notas.firebasestorage.app",
  messagingSenderId: "1064853878716",
  appId: "1:1064853878716:web:2a538b6745a86fa5765db9"
};

// UID da SUA conta (Authentication > Users > User UID). As regras do Firestore
// só liberam leitura/escrita/remoção para este UID.
export const OWNER_UID = "WTQ2AzWUR5hNJEzvT8cnuYC5M0L2";

// (Opcional) site key do reCAPTCHA v3 para o App Check. Vazio = App Check off.
export const RECAPTCHA_SITE_KEY = "6LfbGV0tAAAAAGmfmZ0PdR0nSvz3JbxveRKm_1Xq";

// Retorna true se a config já foi preenchida (evita tentar conectar com placeholders).
export function isConfigured() {
  return !firebaseConfig.apiKey.startsWith("COLE_") &&
         !OWNER_UID.startsWith("COLE_");
}
