"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, type FirestoreError } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * Read/write layer for /account (P1.6). Rule citations below are pinned to
 * `admin-web/firestore.rules` at engine commit `03aee1c` (sibling
 * `ileadit` repo) — re-grep that file at whatever commit is current before
 * trusting a line number here.
 *
 * `users/{uid}` and `users/{uid}/private/profile` are the ONLY two
 * documents this repo writes to directly with the client SDK, anywhere.
 * Every other Firestore mutation in this codebase goes through an engine
 * callable (`src/lib/functions.ts`) — these two are the deliberate
 * exception, because the rules make the owner a first-class writer of their
 * own profile fields (firestore.rules:73-103 for the public doc,
 * firestore.rules:127-136 for private/profile). Do not use this file as
 * precedent for writing anywhere else in Firestore directly.
 */

export interface PublicProfile {
  displayName: string | null;
  avatarIndex: number | null;
  profileImageUrl: string | null;
  city: string | null;
}

export interface PrivateProfile {
  firstName: string | null;
  surname: string | null;
  country: string | null;
  notificationsEnabled: boolean | null;
  profileCompleted: boolean | null;
}

/**
 * ONLY `coins` and `lifetimePoints` from `users/{uid}/private/game`.
 * Deliberately excludes `average` (and `competitionHistory`, whose entries
 * carry `averageSteps`) — both are step-derived figures. CLAUDE.md's Privacy
 * Rules say "the todaySteps and dailyAverageSteps fields ... must never be
 * read or displayed by the web portal" with no carve-out written for the
 * account owner viewing their own page, so this module follows that
 * standing, unconditional project policy. See the P1.6 findings report for
 * the product question this leaves open (the ticket brief that commissioned
 * this file argued the owner should be able to see their own step data —
 * that is a real tension with CLAUDE.md as written, not an oversight).
 */
export interface GameSummary {
  coins: number | null;
  lifetimePoints: number | null;
}

export type AccountProfileState =
  | { status: "loading" }
  | { status: "error"; error: FirestoreError }
  | {
      status: "success";
      publicProfile: PublicProfile;
      privateProfile: PrivateProfile;
      game: GameSummary;
    };

/**
 * Subscribes to the three documents that make up "your account" and emits
 * a single combined state once all three have delivered a first snapshot
 * (mirrors the discriminated-union, never-a-nullable-value discipline of
 * `usePlayingCompetitions`/`useCreatedCompetitions` in `src/lib/
 * playerCompetitions.ts` / `competitions.ts`). Missing documents (a brand
 * new account whose `private/game` hasn't been created by `ensureAccount`
 * yet) resolve to an object of `null` fields rather than blocking forever —
 * `onSnapshot` still fires once for a non-existent document.
 */
export function useAccountProfile(uid: string | null): AccountProfileState {
  const [state, setState] = useState<AccountProfileState>({ status: "loading" });

  useEffect(() => {
    if (!uid) {
      return;
    }

    const db = getFirebaseDb();
    let cancelled = false;

    let publicData: PublicProfile | null = null;
    let privateData: PrivateProfile | null = null;
    let gameData: GameSummary | null = null;

    function emit() {
      if (cancelled || !publicData || !privateData || !gameData) return;
      setState({
        status: "success",
        publicProfile: publicData,
        privateProfile: privateData,
        game: gameData,
      });
    }

    function onFatalError(error: FirestoreError) {
      if (cancelled) return;
      console.error("[useAccountProfile] read failed", error);
      setState({ status: "error", error });
    }

    // firestore.rules:71 — `allow read: if signedIn();` on users/{userId}.
    const unsubPublic = onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        const d = snapshot.data() ?? {};
        publicData = {
          displayName: typeof d.displayName === "string" ? d.displayName : null,
          avatarIndex: typeof d.avatarIndex === "number" ? d.avatarIndex : null,
          profileImageUrl: typeof d.profileImageUrl === "string" ? d.profileImageUrl : null,
          city: typeof d.city === "string" ? d.city : null,
        };
        emit();
      },
      onFatalError,
    );

    // firestore.rules:126 — `allow read: if isOwner(userId);` on
    // users/{userId}/private/profile.
    const unsubPrivate = onSnapshot(
      doc(db, "users", uid, "private", "profile"),
      (snapshot) => {
        const d = snapshot.data() ?? {};
        privateData = {
          firstName: typeof d.firstName === "string" ? d.firstName : null,
          surname: typeof d.surname === "string" ? d.surname : null,
          country: typeof d.country === "string" ? d.country : null,
          notificationsEnabled:
            typeof d.notificationsEnabled === "boolean" ? d.notificationsEnabled : null,
          profileCompleted: typeof d.profileCompleted === "boolean" ? d.profileCompleted : null,
        };
        emit();
      },
      onFatalError,
    );

    // firestore.rules:144 — `allow read: if isOwner(userId);` on
    // users/{userId}/private/game. Write is `if false` for every client
    // (firestore.rules:145) — this hook never writes this document.
    const unsubGame = onSnapshot(
      doc(db, "users", uid, "private", "game"),
      (snapshot) => {
        const d = snapshot.data() ?? {};
        gameData = {
          coins: typeof d.coins === "number" ? d.coins : null,
          lifetimePoints: typeof d.lifetimePoints === "number" ? d.lifetimePoints : null,
        };
        emit();
      },
      onFatalError,
    );

    return () => {
      cancelled = true;
      unsubPublic();
      unsubPrivate();
      unsubGame();
    };
  }, [uid]);

  return state;
}

/** Never a boolean — mirrors `AuthOutcome`/`EngineFailure`'s discriminated
 * shape so a caller can't accidentally treat a failed save as a success. */
export type ProfileUpdateOutcome = { status: "success" } | { status: "error"; message: string };

/**
 * Updates `displayName`/`city` on `users/{uid}` directly with the client
 * SDK. Only these two fields are ever offered from /account's form —
 * `avatarIndex`/`profileImageUrl` are rules-legal to write here too
 * (firestore.rules:78-79, 95-101) but there is no avatar picker/upload flow
 * in this repo yet, so they stay read-only on the page rather than exposing
 * an edit control with nothing real behind it.
 */
export async function updatePublicProfile(
  uid: string,
  fields: { displayName?: string; city?: string },
): Promise<ProfileUpdateOutcome> {
  const updates: Record<string, string> = {};
  if (fields.displayName !== undefined) updates.displayName = fields.displayName;
  if (fields.city !== undefined) updates.city = fields.city;
  if (Object.keys(updates).length === 0) return { status: "success" };

  try {
    await updateDoc(doc(getFirebaseDb(), "users", uid), updates);
    return { status: "success" };
  } catch (error) {
    console.error("[updatePublicProfile] write failed", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong saving your profile.",
    };
  }
}

/**
 * Updates the owner-editable fields on `users/{uid}/private/profile` that
 * the portal offers: firstName, surname, country, notificationsEnabled.
 * Date of birth and gender are deliberately NOT accepted, read or written,
 * ever -- not even as null/empty (F-DOB-1, Paul 25 Sep 2026: iLeadIt does
 * not collect or retain them as profile data).
 * `profileCompleted` is deliberately never written from here even though
 * the rules permit it (firestore.rules:132-135) — it almost certainly drives
 * an onboarding state machine this ticket hasn't read (mobile app and/or a
 * future web onboarding step), and flipping it from a generic settings form
 * risks corrupting that flow. Length limits mirror
 * `profileFieldsValid()` (firestore.rules:116-125) exactly — client
 * validation is a UX nicety, the rule is the real check.
 */
export async function updatePrivateProfile(
  uid: string,
  fields: {
    firstName?: string;
    surname?: string;
    country?: string;
    notificationsEnabled?: boolean;
  },
): Promise<ProfileUpdateOutcome> {
  const updates: Record<string, string | boolean> = {};
  if (fields.firstName !== undefined) updates.firstName = fields.firstName;
  if (fields.surname !== undefined) updates.surname = fields.surname;
  if (fields.country !== undefined) updates.country = fields.country;
  if (fields.notificationsEnabled !== undefined)
    updates.notificationsEnabled = fields.notificationsEnabled;
  if (Object.keys(updates).length === 0) return { status: "success" };

  try {
    await updateDoc(doc(getFirebaseDb(), "users", uid, "private", "profile"), updates);
    return { status: "success" };
  } catch (error) {
    console.error("[updatePrivateProfile] write failed", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong saving your details.",
    };
  }
}
