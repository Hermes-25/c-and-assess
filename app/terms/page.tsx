import type { Metadata } from 'next';
import { LegalPage } from '../_components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of use | C&Assess',
  description: 'Terms for candidates and organizers using the C&Assess assessment platform.',
};

const sections = [
  {
    title: 'About these terms',
    paragraphs: [
      'These terms apply when you use C&Assess, an assessment platform operated by the Consulting & Analytics Club, IIT Guwahati. By registering for or starting an assessment, you agree to these terms and to the rules shown for that assessment.',
      'If an assessment has additional instructions, those instructions apply to that event. If they conflict with this page, contact the C&A Team before starting.',
    ],
  },
  {
    title: 'Eligibility and accounts',
    items: [
      'Use your own Google account and provide accurate registration information.',
      'Register only when you satisfy the eligibility requirements shown for the assessment.',
      'Do not share an assessment session, impersonate another candidate or attempt to access another person’s report.',
      'Organizer access is restricted and may be removed when a role changes or access is no longer required.',
    ],
  },
  {
    title: 'Assessment conduct',
    paragraphs: ['The pre-test screen explains the timer, marking scheme, permitted materials and integrity rules. Starting the assessment confirms that you have read them.'],
    items: [
      'Do not copy, distribute, publish or sell live or unreleased questions, solutions or access links.',
      'Do not use unauthorized assistance, automation or another person to complete an assessment.',
      'Do not interfere with C&Assess, test its security during a live event or attempt to bypass access controls.',
      'Tab-switch and full-screen signals are indicators for organizer review; they are not treated as infallible proof by themselves.',
    ],
  },
  {
    title: 'Saving, submission and results',
    paragraphs: [
      'C&Assess periodically saves progress, but you remain responsible for using a supported browser, a reasonably stable connection and the final submission control before time expires. The server clock and the assessment’s published window determine availability.',
      'Objective scoring follows the answer key and marking rules attached to the paper version delivered to you. Rank, percentile and cohort statistics can change when an organizer excludes an invalid question, corrects an answer key or excludes an ineligible attempt. Results become final only when the organizer releases them.',
      'Report a suspected scoring or technical error promptly using the contact details supplied for the assessment. The C&A Team may preserve audit information while reviewing the issue.',
    ],
  },
  {
    title: 'Question content and acceptable use',
    paragraphs: [
      'Unless an assessment states otherwise, its questions, explanations, branding and supporting material are provided for personal participation and learning. Your permission to view them does not transfer ownership or authorize republication.',
      'C&Assess may link to third-party material. The relevant third party remains responsible for that material and its terms.',
    ],
  },
  {
    title: 'Availability and limitations',
    paragraphs: [
      'The C&A Team works to keep C&Assess reliable, but availability can be affected by device problems, internet providers, Google sign-in, Cloudflare or emergency maintenance. When a verified platform incident affects fairness, organizers may extend a window, reopen an attempt or use another reasonable remedy.',
      'C&Assess is a club-operated assessment service, not a promise of employment, internship selection, academic credit or admission. Practice scores and recommendations are guidance, not guarantees of future performance.',
    ],
  },
  {
    title: 'Enforcement and changes',
    paragraphs: [
      'The C&A Team may restrict an account, invalidate an attempt or remove access when there is reasonable evidence of ineligibility, misuse or a serious rule violation. Material decisions should be documented and candidates should have a way to raise a correction or appeal.',
      'These terms may change as the platform or club process changes. The updated date will appear at the top of this page. Questions can be sent to caciitg@gmail.com.',
    ],
  },
];

export default function TermsPage() {
  return <LegalPage eyebrow="Using the platform" title="Terms of use" summary="The practical rules that keep C&Assess fair, secure and understandable for candidates and organizers." updated="3 September 2026" sections={sections} />;
}

