/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FieldConfig {
  id: string;
  name: string;
  type: 'text' | 'tel' | 'photo';
  question: string;
}

export interface EventConfig {
  id: string;
  userId?: string; // Links event to the creator user
  name: string;
  fields: FieldConfig[];
}

export interface VisitorRegistration {
  id: string;
  eventId: string;
  eventName: string;
  timestamp: string;
  fields: { [fieldId: string]: string };
}

export interface UserProfile {
  uid: string; // Typically their mobile number or a unique string
  name: string;
  mobile: string;
  email: string;
  createdAt: string;
}
