import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy notice | C&Assess',
  description: 'How the Consulting & Analytics Club, IIT Guwahati handles information submitted through C&Assess.',
};

const sections = [
  {
    title: 'Who operates C&Assess',
    paragraphs: [
      'C&Assess is operated by the Consulting & Analytics Club, IIT Guwahati (the “C&A Team”) to conduct club assessments, practice tests and related evaluations. Questions about this notice or your information can be sent to caciitg@gmail.com.',
    ],
  },
  {
    title: 'Information we collect',
    paragraphs: ['We collect only the information needed to register you, conduct an assessment, protect its integrity and prepare your result.'],
    items: [
      'Google account identity: name, verified email address, profile image when supplied by Google, and a provider-specific account identifier.',
      'Registration details: institute, programme or branch, graduation year, consent and eligibility information requested for a particular assessment.',
      'Assessment activity: answers, saved progress, marks for review, question timing, start and submission times, and the paper version you received.',
      'Declared integrity signals: events such as leaving the assessment tab or full-screen experience. C&Assess does not record your webcam, microphone or screen.',
      'Results and learning information: score, accuracy, rank, percentile, question outcomes, error-tracker labels and generated practice recommendations.',
      'Basic technical records needed for security, troubleshooting and reliable delivery, such as request timestamps and application errors.',
    ],
  },
  {
    title: 'How we use information',
    items: [
      'Authenticate your account and keep your attempt connected to you.',
      'Confirm eligibility, accept registrations and operate scheduled assessment windows.',
      'Save responses, score objective questions and produce candidate-facing analysis.',
      'Calculate cohort statistics such as rank, percentile and question difficulty.',
      'Review declared integrity signals, investigate technical incidents and correct evaluation errors.',
      'Improve future assessments using aggregated or de-identified performance patterns.',
    ],
  },
  {
    title: 'Where information is processed',
    paragraphs: [
      'C&Assess uses Google for sign-in and Cloudflare infrastructure for application delivery, structured records and question-image storage. These providers process limited information on our behalf under their own security and privacy terms.',
      'We do not sell candidate information or use assessment answers for advertising. We do not give individual results to other candidates. Organizers with approved access can view records required to operate and evaluate an assessment.',
    ],
  },
  {
    title: 'Cookies and account security',
    paragraphs: [
      'After Google confirms your identity, C&Assess stores a signed, secure, HTTP-only session cookie so you remain signed in. Temporary cookies protect the Google sign-in exchange. They are not advertising cookies.',
      'Do not share your signed-in device during an assessment. Sign out when using a shared computer. Although reasonable safeguards are used, no online service can promise absolute security.',
    ],
  },
  {
    title: 'Retention and deletion',
    paragraphs: [
      'Candidate-level records are kept only while needed for assessment operations, result review, dispute handling, security and legitimate club records. The C&A Team periodically reviews records and removes information that is no longer needed. Aggregated or de-identified statistics may be retained for longer because they no longer identify an individual candidate.',
      'You may ask to access, correct or delete your information by emailing caciitg@gmail.com from the Google account used on C&Assess. Some records may need to be retained temporarily to resolve an active result dispute, investigate misuse or meet an applicable institutional requirement.',
    ],
  },
  {
    title: 'Choices and updates',
    paragraphs: [
      'Registration notices explain the data and rules relevant to each assessment. You can choose not to register; if you withdraw during an active assessment, contact the C&A Team because deleting an in-progress record may affect scoring or cohort calculations.',
      'We may update this notice when C&Assess gains a new capability or its service providers change. Material changes will be reflected by the date at the top of this page.',
    ],
  },
];

export default function PrivacyPage() {
  return <LegalPage eyebrow="Your information" title="Privacy notice" summary="A plain-language explanation of what C&Assess records, why it is needed and the choices available to candidates." updated="3 September 2026" sections={sections} />;
}

