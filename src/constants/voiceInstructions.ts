/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { EventConfig, FieldConfig } from '../types';

export const DEFAULT_FIELDS: FieldConfig[] = [
  {
    id: 'name',
    name: 'Full Name',
    type: 'text',
    question: 'Could you please tell me your full name?'
  },
  {
    id: 'mobile',
    name: 'Mobile Number',
    type: 'tel',
    question: 'what is your mobile number?'
  },
  {
    id: 'purpose',
    name: 'Purpose of Visit',
    type: 'text',
    question: 'what is the purpose of your visit today?'
  },
  {
    id: 'photo',
    name: 'Visitor Photo',
    type: 'photo',
    question: 'Please look straight into the visitor camera for a moment so I can capture your photo?'
  }
];

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  id: 'visitor_registration',
  name: 'visitor registration',
  fields: DEFAULT_FIELDS
};

export const DEFAULT_VOICE_INSTRUCTIONS = {
  GREETING: "Hello there! Welcome! Let's get you registered. Please answer the following questions.",
  PHOTO_CAPTURED: "Great! Captured your photo successfully.",
  GOT_ANSWER: "Got it, thank you.",
  RETRY_PREFIX: "Sorry, I didn't hear you. ",
  TIMEOUT_RESET: "No answer was received. I am resetting the registration. Please say Hi or Hey to check in.",
  REGISTRATION_SUCCESS: "Your check-in is complete! Thank you. Have an amazing event!",
  UNSUPPORTED_BROWSER_ALERT: "Your browser does not fully support Web Speech recognition or synthesis. Standard form input remains available.",
  CUSTOM_FIELD_DEFAULT_QUESTION: "Please state your answer."
};

export const VOICE_INSTRUCTIONS = DEFAULT_VOICE_INSTRUCTIONS;

export type VoiceInstructionsConfig = typeof DEFAULT_VOICE_INSTRUCTIONS;

export const UI_SUGGESTIONS = {
  AGENT_ACTIVE: "Walk up to the microphone and say 'Hi' or 'Hey' to initiate touchless entry.",
  AGENT_OFFLINE: "Register manually using the form fields below or click 'Start Agent' above."
};
