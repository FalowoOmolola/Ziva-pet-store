import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const MODEL_API_URL = 'https://bucked-gladiator-overdress.ngrok-free.dev/predict';

export const predictDisease = async (symptoms) => {
  try {
    const response = await fetch(MODEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ symptoms }),
    });

    if (!response.ok) throw new Error(`Model server returned ${response.status}.`);
    return response.json();
  } catch (error) {
    throw new Error(`Could not reach the prediction model at ${MODEL_API_URL}. Make sure the model server is running and the app is using the correct computer IP address.`);
  }
};

const firebaseConfig = {
  apiKey: 'AIzaSyCosHTFKkvPjNAvekGZjCR2BzjhKxsH0uI',
  authDomain: 'ziva-pet-world.firebaseapp.com',
  projectId: 'ziva-pet-world',
  storageBucket: 'ziva-pet-world.firebasestorage.app',
  messagingSenderId: '167732915180',
  appId: '1:167732915180:web:0f1654caa2779f9571eec9',
  measurementId: 'G-4NNH4494T5',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ZIVA_ADMIN_EMAIL = 'admin@zivapetworld.com';

export function isZivaAdminEmail(email = '') {
  return email.trim().toLowerCase() === ZIVA_ADMIN_EMAIL;
}

const diagnosisRules = [
  {
    illness: 'Canine Parvovirus',
    severity: 'High',
    confidence: 84,
    match: ['Vomiting', 'Diarrhea', 'Fever'],
    description:
      'Highly contagious viral illness attacking the GI tract and immune system. Common in unvaccinated puppies.',
    advice: [
      'Keep your pet hydrated with small sips of water frequently.',
      'Withhold solid food for 12-24 hours unless a vet advises otherwise.',
      'Isolate from other dogs immediately.',
    ],
    vetMessage: 'Visit a vet immediately. Parvovirus can be fatal within 48-72 hours without treatment.',
  },
  {
    illness: 'Kennel Cough',
    severity: 'Medium',
    confidence: 76,
    match: ['Coughing', 'Fever', 'Lethargy'],
    description: 'A contagious respiratory infection that often causes coughing, tiredness, and mild fever.',
    advice: [
      'Keep your pet rested and away from other dogs.',
      'Use a humid room to ease breathing discomfort.',
      'Contact a vet if coughing worsens or fever continues.',
    ],
    vetMessage: 'Book a vet visit if symptoms continue for more than 24 hours.',
  },
  {
    illness: 'Canine Dermatitis',
    severity: 'Low',
    confidence: 72,
    match: ['Skin irritation', 'Loss of appetite', 'Lethargy'],
    description: 'Skin inflammation that may be caused by allergies, parasites, or irritation.',
    advice: [
      'Prevent scratching or licking the irritated area.',
      'Check for fleas, wounds, or new grooming products.',
      'Schedule a vet check if redness spreads.',
    ],
    vetMessage: 'A non-urgent vet check is recommended if symptoms persist.',
  },
];

export function setAuthToken() {
  // Kept for compatibility with the existing screen code. Firebase manages auth sessions.
}

function authMessage(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Firebase blocked this action. Check your Firestore security rules.';
  if (code.includes('auth/invalid-credential')) return 'Invalid email or password.';
  if (code.includes('auth/email-already-in-use')) return 'An account already exists for this email.';
  if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('auth/invalid-email')) return 'Enter a valid email address.';
  if (code.includes('auth/user-not-found')) return 'No account found for this email.';
  return error?.message || 'Something went wrong.';
}

function publicUser(firebaseUser, profile = {}) {
  const pets = normalizePets(profile);
  const activePetId = profile.activePetId || pets[0]?.id;
  const pet = pets.find((item) => item.id === activePetId) || pets[0];
  const email = firebaseUser.email || profile.email;
  const role = email?.toLowerCase() === ZIVA_ADMIN_EMAIL ? 'admin' : profile.role || 'user';

  return {
    id: firebaseUser.uid,
    name: profile.name || firebaseUser.displayName || 'Pet Owner',
    email,
    phone: profile.phone || '',
    role,
    pet,
    pets,
    activePetId: pet?.id,
  };
}

function normalizePets(profile = {}) {
  if (Array.isArray(profile.pets)) return profile.pets;
  if (profile.pet) return [{ id: profile.pet.id || `pet_${Date.now()}`, species: 'Dog', ...profile.pet }];
  return [];
}

async function getProfile(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const isZivaAdmin = firebaseUser.email?.toLowerCase() === ZIVA_ADMIN_EMAIL;

  if (!snapshot.exists()) {
    const pet = isZivaAdmin
      ? null
      : {
          id: `pet_${Date.now()}`,
          name: 'Max',
          species: 'Dog',
          breed: 'Golden Retriever',
          age: '3 years',
        };
    const profile = {
      name: firebaseUser.displayName || 'Pet Owner',
      email: firebaseUser.email,
      phone: '',
      pets: pet ? [pet] : [],
      activePetId: pet?.id || null,
      role: isZivaAdmin ? 'admin' : 'user',
      createdAt: Date.now(),
    };
    await setDoc(userRef, profile);
    return profile;
  }

  const profile = snapshot.data();
  const pets = normalizePets(profile);

  if (isZivaAdmin && profile.role !== 'admin') {
    await setDoc(userRef, { role: 'admin' }, { merge: true });
    profile.role = 'admin';
  }

  if (!profile.pets || (pets.length > 0 && !profile.activePetId)) {
    const migrated = { ...profile, pets, activePetId: profile.activePetId || pets[0]?.id || null };
    await setDoc(userRef, migrated, { merge: true });
    return migrated;
  }

  return profile;
}

async function getHistory(uid) {
  const historyRef = collection(db, 'users', uid, 'diagnoses');
  const snapshot = await getDocs(query(historyRef, orderBy('createdAt', 'desc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getAppointments(uid) {
  const snapshot = await getDocs(query(collection(db, 'appointments'), where('userId', '==', uid)));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function getAdminAppointments() {
  const snapshot = await getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function normalizeModelResult(data, symptoms, petName) {
  return {
    petName,
    illness: data?.diagnosis || data?.illness || 'Possible health concern',
    severity: data?.severity || 'Medium',
    confidence: Number(data?.confidence || 80),
    symptoms: symptoms.split(',').map((item) => item.trim()).filter(Boolean),
    description: data?.description || data?.recommendation || 'The model reviewed the symptoms you entered.',
    advice: Array.isArray(data?.advice) ? data.advice : [data?.advice || 'Keep your dog calm and hydrated while you contact a vet.'],
    vetMessage: data?.recommendation || 'Contact a vet for professional confirmation.',
    status: 'Model prediction',
    date: 'Today',
    createdAt: Date.now(),
  };
}

function makeDiagnosis(symptoms, petName = 'your pet') {
  const selected = new Set(symptoms);
  const best =
    diagnosisRules
      .map((rule) => ({
        ...rule,
        score: rule.match.filter((symptom) => selected.has(symptom)).length,
      }))
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)[0] || diagnosisRules[0];

  return {
    petName,
    illness: best.illness,
    severity: best.severity,
    confidence: Math.min(96, best.confidence + Math.max(0, symptoms.length - best.score) * 2),
    symptoms,
    description: best.description,
    advice: best.advice,
    vetMessage: best.vetMessage,
    status: best.severity === 'High' ? 'Pending vet visit' : 'Monitoring',
    date: 'Today',
    createdAt: Date.now(),
  };
}

async function authResult(firebaseUser) {
  const profile = await getProfile(firebaseUser);
  const history = await getHistory(firebaseUser.uid);
  const user = publicUser(firebaseUser, profile);
  const appointments = await getAppointments(firebaseUser.uid);
  const adminAppointments = user.role === 'admin' ? await getAdminAppointments() : [];
  return { token: firebaseUser.uid, user, history, appointments, adminAppointments };
}

export const api = {
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  authResult(firebaseUser) {
    return authResult(firebaseUser);
  },

  async login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return authResult(credential.user);
    } catch (error) {
      throw new Error(authMessage(error));
    }
  },

  async signup(name, email, password, pet) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(credential.user, { displayName: name });
      const isAdmin = isZivaAdminEmail(email);

      const firstPet = isAdmin
        ? null
        : {
            id: `pet_${Date.now()}`,
            name: pet.name,
            species: 'Dog',
            breed: pet.breed,
            age: pet.age,
          };

      const profile = {
        name,
        email,
        phone: '',
        pets: firstPet ? [firstPet] : [],
        activePetId: firstPet?.id || null,
        role: isAdmin ? 'admin' : 'user',
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'users', credential.user.uid), profile);
      return { token: credential.user.uid, user: publicUser(credential.user, profile), history: [] };
    } catch (error) {
      throw new Error(authMessage(error));
    }
  },

  async forgotPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { message: 'If this email has a Ziva account, Firebase will send a password reset link. Check your inbox and spam folder.' };
    } catch (error) {
      throw new Error(authMessage(error));
    }
  },

  async resetPassword() {
    throw new Error('Use the password reset link sent to your email.');
  },

  async logout() {
    await signOut(auth);
  },

  async updateProfile(updates) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const nextProfile = {
      ...profile,
      name: updates.name,
      phone: updates.phone,
    };

    if (updates.name && updates.name !== auth.currentUser.displayName) {
      await updateFirebaseProfile(auth.currentUser, { displayName: updates.name });
    }

    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      name: nextProfile.name,
      phone: nextProfile.phone,
    });

    const history = await getHistory(auth.currentUser.uid);
    return { user: publicUser(auth.currentUser, nextProfile), history };
  },

  async updatePet(petId, updates) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const pets = normalizePets(profile);
    const nextPets = pets.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet));
    if (!nextPets.some((pet) => pet.id === petId)) throw new Error('Dog not found.');

    const nextProfile = { ...profile, pets: nextPets };
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { pets: nextPets });
    const history = await getHistory(auth.currentUser.uid);
    return { user: publicUser(auth.currentUser, nextProfile), history };
  },

  async deletePet(petId) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const pets = normalizePets(profile);

    const nextPets = pets.filter((pet) => pet.id !== petId);
    if (nextPets.length === pets.length) throw new Error('Dog not found.');

    const activePetId = profile.activePetId === petId ? nextPets[0]?.id || null : profile.activePetId || nextPets[0]?.id || null;
    const nextProfile = { ...profile, pets: nextPets, activePetId };

    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      pets: nextPets,
      activePetId,
    });

    const history = await getHistory(auth.currentUser.uid);
    return { user: publicUser(auth.currentUser, nextProfile), history };
  },

  async addPet(pet) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const pets = normalizePets(profile);
    const nextPet = {
      id: `pet_${Date.now()}`,
      name: pet.name,
      species: 'Dog',
      breed: pet.breed,
      age: pet.age,
    };

    const nextProfile = {
      ...profile,
      pets: [...pets, nextPet],
      activePetId: nextPet.id,
    };

    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      pets: nextProfile.pets,
      activePetId: nextPet.id,
    });

    const history = await getHistory(auth.currentUser.uid);
    return { user: publicUser(auth.currentUser, nextProfile), history };
  },

  async setActivePet(petId) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const pets = normalizePets(profile);
    if (!pets.some((pet) => pet.id === petId)) throw new Error('Dog not found.');

    const nextProfile = { ...profile, pets, activePetId: petId };
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { activePetId: petId });
    const history = await getHistory(auth.currentUser.uid);
    return { user: publicUser(auth.currentUser, nextProfile), history };
  },

  async createAppointment(payload) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const user = publicUser(auth.currentUser, profile);
    const pet = user.pets.find((item) => item.id === payload.petId);
    if (!pet) throw new Error('Select a dog for this appointment.');
    if (!payload.reason || !payload.date || !payload.time) throw new Error('Reason, date, and time are required.');

    const appointment = {
      userId: auth.currentUser.uid,
      ownerName: user.name,
      ownerEmail: user.email,
      ownerPhone: user.phone || '',
      petId: pet.id,
      petName: pet.name,
      petBreed: pet.breed,
      reason: payload.reason,
      date: payload.date,
      time: payload.time,
      notes: payload.notes || '',
      status: 'pending',
      vetNote: '',
      createdAt: Date.now(),
    };

    await addDoc(collection(db, 'appointments'), appointment);
    return { appointments: await getAppointments(auth.currentUser.uid) };
  },

  async getAppointments() {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    return { appointments: await getAppointments(auth.currentUser.uid) };
  },

  async getAdminAppointments() {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const user = publicUser(auth.currentUser, profile);
    if (user.role !== 'admin') throw new Error('Admin access only.');
    return { appointments: await getAdminAppointments() };
  },

  async updateAppointmentStatus(appointmentId, status, vetNote = '') {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const user = publicUser(auth.currentUser, profile);
    if (user.role !== 'admin') throw new Error('Admin access only.');

    await updateDoc(doc(db, 'appointments', appointmentId), {
      status,
      vetNote,
      updatedAt: Date.now(),
    });

    return { appointments: await getAdminAppointments() };
  },

  async me() {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    return authResult(auth.currentUser);
  },

  async predictDisease(symptomsText) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const currentUser = publicUser(auth.currentUser, profile);
    if (!currentUser.pet) throw new Error('Add a dog profile before running a prediction.');

    const modelResult = await predictDisease(symptomsText);
    const diagnosis = {
      ...normalizeModelResult(modelResult, symptomsText, currentUser.pet.name),
      petId: currentUser.pet.id,
      petName: currentUser.pet.name,
    };

    const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'diagnoses'), diagnosis);
    const savedDiagnosis = { id: docRef.id, ...diagnosis };
    const history = await getHistory(auth.currentUser.uid);

    return { diagnosis: savedDiagnosis, history };
  },

  async diagnose(symptoms) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    if (!symptoms.length) throw new Error('Select at least one symptom.');

    const profile = await getProfile(auth.currentUser);
    const currentUser = publicUser(auth.currentUser, profile);
    if (!currentUser.pet) throw new Error('Add a dog profile before running a diagnosis.');
    const diagnosis = {
      ...makeDiagnosis(symptoms, currentUser.pet?.name),
      petId: currentUser.pet?.id,
      petName: currentUser.pet?.name,
    };
    const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'diagnoses'), diagnosis);
    const savedDiagnosis = { id: docRef.id, ...diagnosis };
    const history = await getHistory(auth.currentUser.uid);

    return { diagnosis: savedDiagnosis, history };
  },

  async chat(message) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    const profile = await getProfile(auth.currentUser);
    const currentUser = publicUser(auth.currentUser, profile);
    if (!currentUser.pet) {
      return { reply: 'Please add a dog profile first, then I can help with symptoms.' };
    }
    const petName = currentUser.pet?.name || 'your pet';
    const lower = String(message || '').toLowerCase();
    let reply = `Tell me what symptoms ${petName} is showing, and I can help you narrow it down.`;

    if (lower.includes('vomit') || lower.includes('diarrhea')) {
      reply = `Vomiting and diarrhea can become serious quickly. Is ${petName} also feverish or unusually tired?`;
    } else if (lower.includes('fever')) {
      reply = 'A fever alongside stomach symptoms is a warning sign. I recommend running a diagnosis and contacting a vet.';
    } else if (lower.includes(petName.toLowerCase())) {
      reply = `Thanks. I have ${petName}'s profile ready. What symptoms are you noticing today?`;
    }

    return { reply };
  },
};
