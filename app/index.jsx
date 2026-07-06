import { useEffect, useMemo, useState } from 'react';
import { Linking, SafeAreaView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppThemeProvider, TPressable, TScrollView, TText, TTextInput, TView, colors, useAppTheme } from '@/components/TailwindPrimitives';
import { api, isZivaAdminEmail, setAuthToken } from '@/lib/api';

const symptomOptions = ['Vomiting', 'Diarrhea', 'Fever', 'Loss of appetite', 'Skin irritation', 'Coughing', 'Lethargy'];

// const fallbackUser = {
//   name: 'Falowo Omolola',
//   email: 'rachealomololafalowo@gmail.com',
//   phone: '+234 801 234 5678',
//   pet: {
//     id: 'pet_max',
//     name: 'Max',
//     species: 'Dog',
//     breed: 'Golden Retriever',
//     age: '3 years',
//     weight: '28 kg',
//   },
//   pets: [
//     {
//       id: 'pet_max',
//       name: 'Max',
//       species: 'Dog',
//       breed: 'Golden Retriever',
//       age: '3 years',
//       weight: '28 kg',
//     },
//   ],
//   activePetId: 'pet_max',
// };

function PawLogo({ size = 84 }) {
  return (
    <TView className="items-center justify-center border border-green-line rounded-full bg-green-soft" style={{ width: size, height: size }}>
      <MaterialCommunityIcons name="paw" size={size * 0.48} color={colors.green} />
    </TView>
  );
}

function AppFrame({ children, nav, active, go }) {
  const theme = useAppTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.black }]}>
      <TView className="flex-1 bg-black">
        <TView className="flex-1">{children}</TView>
        {nav ? <BottomNav active={active} go={go} /> : null}
      </TView>
    </SafeAreaView>
  );
}

function BottomNav({ active, go }) {
  const items = [
    ['dashboard', 'home-variant', 'Home'],
    ['chat', 'message-text', 'Ziva AI'],
    ['appointments', 'calendar-clock', 'Bookings'],
    ['history', 'clipboard-text-clock', 'History'],
    ['profile', 'account', 'Profile'],
  ];

  return (
    <TView className="flex-row bg-surface border-t border-line pt-2 pb-3">
      {items.map(([screen, icon, label]) => {
        const selected = active === screen;
        return (
          <TPressable key={screen} onPress={() => go(screen)} className="flex-1 items-center gap-1">
            <TView className={`w-5 h-1 rounded-full ${selected ? 'bg-green' : ''}`} />
            <MaterialCommunityIcons name={icon} size={22} color={selected ? colors.green : colors.dim} />
            <TText className={`text-2xs ${selected ? 'text-green font-bold' : 'text-dim'}`}>{label}</TText>
          </TPressable>
        );
      })}
    </TView>
  );
}

function Splash({ go }) {
  return (
    <AppFrame>
      <TView className="flex-1 items-center justify-center px-6 gap-4">
        <PawLogo />
        <TText className="text-4xl font-extrabold text-green text-center leading-8">Ziva Pet{'\n'}World</TText>
        <TText className="text-sm text-dim text-center">where pets feel loved</TText>
        <TPressable onPress={() => go('auth')} className="bg-green rounded-xl px-8 py-3 mt-8">
          <TText className="text-black text-base font-extrabold">Get started</TText>
        </TPressable>
      </TView>
    </AppFrame>
  );
}

function Auth({ go, onAuth }) {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    dogName: '',
    dogBreed: '',
    dogAge: '',
    dogWeight: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  const adminSignup = signup && isZivaAdminEmail(form.email);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setError('');
    setNotice('');
    if (signup && form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const pet = {
        name: form.dogName.trim(),
        breed: form.dogBreed.trim(),
        age: form.dogAge.trim(),
        weight: form.dogWeight.trim(),
      };

      if (signup && !adminSignup && (!pet.name || !pet.breed || !pet.age || !pet.weight)) {
        setError('Please complete your dog details.');
        setLoading(false);
        return;
      }

      const result = signup
        ? await api.signup(form.name.trim(), form.email.trim(), form.password, pet)
        : await api.login(form.email.trim(), form.password);

      setAuthToken(result.token);
      onAuth(result.user, result.history || [], result.appointments || [], result.adminAppointments || []);
      go(result.user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestResetCode() {
    setError('');
    setNotice('');
    if (!form.email.trim()) {
      setError('Enter the email address you used to sign up.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.forgotPassword(form.email.trim());
      setNotice(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame>
      <TScrollView className="flex-1" contentContainerStyle={styles.authContent}>
        <TView className="flex-row items-center gap-2">
          <PawLogo size={32} />
          <TText className="text-base font-bold text-green">Ziva Pet World</TText>
        </TView>

        <TView>
          <TText className="text-3xl font-extrabold text-text">Welcome back</TText>
          <TText className="text-sm text-dim mt-1">Sign in to care for your pet</TText>
          <TText className="text-xs text-dim mt-1">Ziva admin: admin@zivapetworld.com</TText>
        </TView>

        <TView className="flex-row bg-card rounded-xl p-1">
          <Segment label="Sign in" selected={!signup} onPress={() => setMode('signin')} />
          <Segment label="Sign up" selected={signup} onPress={() => setMode('signup')} />
        </TView>

        <TView className="flex-row gap-2">
          <TPressable onPress={() => setMode('forgot')} className={`flex-1 border rounded-xl py-2 ${forgot ? 'bg-green border-green' : 'border-green-line'}`}>
            <TText className={`text-center text-xs font-bold ${forgot ? 'text-black' : 'text-green'}`}>Forgot password</TText>
          </TPressable>
        </TView>

        {forgot ? (
          <>
            <SectionLabel>Password reset</SectionLabel>
            <Field label="Email address" value={form.email} onChangeText={(text) => update('email', text)} />
            <TText className="text-xs text-dim leading-5">Enter your email and Firebase will send a secure password reset link.</TText>
          </>
        ) : null}

        {!forgot && signup ? (
          <>
            <SectionLabel>Owner details</SectionLabel>
            <Field label="Full name" value={form.name} onChangeText={(text) => update('name', text)} />
          </>
        ) : null}
        {!forgot ? <Field label="Email address" value={form.email} onChangeText={(text) => update('email', text)} /> : null}
        {!forgot ? <Field label="Password" value={form.password} onChangeText={(text) => update('password', text)} secureTextEntry /> : null}
        {!forgot && signup ? <Field label="Confirm password" value={form.confirm} onChangeText={(text) => update('confirm', text)} secureTextEntry /> : null}

        {!forgot && signup && adminSignup ? (
          <TView className="bg-green-soft border border-green-line rounded-2xl p-3">
            <TText className="text-sm text-green font-bold">Ziva admin account</TText>
            <TText className="text-xs text-dim mt-1">Dog details are not required for the admin account.</TText>
          </TView>
        ) : null}

        {!forgot && signup && !adminSignup ? (
          <>
            <SectionLabel>Dog details</SectionLabel>
            <Field label="Dog name" value={form.dogName} onChangeText={(text) => update('dogName', text)} />
            <Field label="Breed" value={form.dogBreed} onChangeText={(text) => update('dogBreed', text)} />
            <TView className="flex-row gap-2">
              <TView className="flex-1">
                <Field label="Age" value={form.dogAge} onChangeText={(text) => update('dogAge', text)} />
              </TView>
              <TView className="flex-1">
                <Field label="Weight" value={form.dogWeight} onChangeText={(text) => update('dogWeight', text)} />
              </TView>
            </TView>
          </>
        ) : null}

        {notice ? <TText className="text-green text-xs">{notice}</TText> : null}
        {error ? <TText className="text-red text-xs">{error}</TText> : null}

        {!forgot ? (
          <TPressable onPress={submit} className="bg-green rounded-xl py-3">
            <TText className="text-black text-center text-base font-extrabold">
              {loading ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}
            </TText>
          </TPressable>
        ) : null}

        {forgot ? (
          <TPressable onPress={requestResetCode} className="bg-green rounded-xl py-3">
            <TText className="text-black text-center text-base font-extrabold">{loading ? 'Sending...' : 'Send reset email'}</TText>
          </TPressable>
        ) : null}

      </TScrollView>
    </AppFrame>
  );
}

function Segment({ label, selected, onPress }) {
  return (
    <TPressable onPress={onPress} className={`flex-1 py-2 rounded-lg ${selected ? 'bg-green' : ''}`}>
      <TText className={`text-center text-sm font-bold ${selected ? 'text-black' : 'text-dim'}`}>{label}</TText>
    </TPressable>
  );
}

function Field({ label, ...props }) {
  return (
    <TView className="gap-1">
      <TText className="text-2xs text-dim uppercase font-bold">{label}</TText>
      <TTextInput
        {...props}
        placeholder={props.placeholder || label}
        placeholderTextColor={colors.dim}
        className="bg-card border border-line rounded-xl px-3 py-3 text-sub text-sm"
      />
    </TView>
  );
}

function Dashboard({ screen, go, user, history, onSelectPet, themeMode, onToggleTheme }) {
  const pet = user.pet;
  const highCount = history.filter((item) => item.severity === 'High').length;
  const resolvedCount = history.filter((item) => item.status === 'Resolved').length;

  const actions = [
    ['chat', 'medical-bag', 'Check symptoms', 'AI diagnosis', true],
    ['appointments', 'calendar-clock', 'Book appointment', 'Vet visit'],
    ['history', 'clipboard-text-clock', 'View history', `${history.length} records`],
    ['chat', 'message-text', 'Consult Ziva', 'Chat now'],
    ['profile', 'account', 'My profile', 'Edit details'],
  ];

  return (
    <AppFrame nav active={screen} go={go}>
      <TScrollView className="flex-1" contentContainerStyle={styles.contentWithNav}>
        <TView className="flex-row justify-between items-center">
          <TView>
            <TText className="text-sm text-dim">Welcome,</TText>
            <TText className="text-2xl font-extrabold text-text">{firstName(user.name)}</TText>
          </TView>
          <TView className="flex-row items-center gap-2">
            <TPressable onPress={onToggleTheme} className="w-10 h-10 rounded-full bg-card border border-green-line items-center justify-center">
              <Ionicons name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={19} color={colors.green} />
            </TPressable>
            <TView className="w-10 h-10 rounded-full bg-green items-center justify-center">
              <TText className="text-black text-lg font-extrabold">{initials(user.name)}</TText>
            </TView>
          </TView>
        </TView>

        <TView className="flex-row items-center gap-3 bg-card border border-green-line rounded-3xl p-3">
          <TView className="w-12 h-12 bg-green-soft rounded-xl items-center justify-center">
            <MaterialCommunityIcons name="dog" size={28} color={colors.green} />
          </TView>
          <TView className="flex-1">
            <TText className="text-lg font-bold text-text">{pet?.name || 'No dog profile'}</TText>
            <TText className="text-xs text-dim">{pet ? `${pet.breed} - ${pet.age} - ${pet.weight}` : 'Add a dog from Profile to start diagnosis'}</TText>
          </TView>
          {pet ? <TView className="flex-row items-center gap-1 bg-green-soft rounded-full px-2 py-1">
            <TView className="w-1.5 h-1.5 rounded-full bg-green" />
            <TText className="text-2xs text-green">Active</TText>
          </TView> : null}
        </TView>

        <TScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TView className="flex-row gap-2">
            {user.pets.map((item) => {
              const selected = item.id === user.activePetId;
              return (
                <TPressable
                  key={item.id}
                  onPress={() => onSelectPet(item.id)}
                  className={`flex-row items-center gap-2 border rounded-full px-3 py-2 ${selected ? 'bg-green border-green' : 'bg-card border-green-line'}`}
                >
                  <MaterialCommunityIcons name="dog" size={16} color={selected ? colors.black : colors.green} />
                  <TText className={`text-xs font-bold ${selected ? 'text-black' : 'text-green'}`}>{item.name}</TText>
                </TPressable>
              );
            })}
            {!user.pets.length ? (
              <TView className="border border-line rounded-full px-3 py-2">
                <TText className="text-xs text-dim">No dogs yet</TText>
              </TView>
            ) : null}
            <TPressable onPress={() => go('profile')} className="flex-row items-center gap-2 border border-green-line rounded-full px-3 py-2">
              <Ionicons name="add" size={16} color={colors.green} />
              <TText className="text-xs font-bold text-green">Add dog</TText>
            </TPressable>
          </TView>
        </TScrollView>

        <TView className="flex-row gap-2">
          <Stat number={String(history.length)} label="Total" color={colors.text} />
          <Stat number={String(highCount)} label="High" color={colors.red} />
          <Stat number={String(resolvedCount)} label="Resolved" color={colors.green} />
        </TView>

        <SectionLabel>Quick actions</SectionLabel>
        <TView className="flex-row flex-wrap gap-2">
          {actions.map(([target, icon, title, subtitle, active]) => (
            <TPressable
              key={title}
              onPress={() => go(target)}
              className={`border rounded-3xl p-3 gap-1 ${active ? 'bg-green-soft border-green-line' : 'bg-card border-line'}`}
              style={styles.actionCard}
            >
              <MaterialCommunityIcons name={icon} size={24} color={active ? colors.green : colors.sub} />
              <TText className={`text-sm font-bold ${active ? 'text-green' : 'text-text'}`}>{title}</TText>
              <TText className="text-2xs text-dim">{subtitle}</TText>
            </TPressable>
          ))}
        </TView>

        <SectionLabel>Canine health tip</SectionLabel>
        <TView className="flex-row gap-3 bg-card border border-line rounded-2xl p-3">
          <Ionicons name="water" size={22} color={colors.blue} />
          <TText className="flex-1 text-xs text-sub leading-5">Dogs need 50-60ml of water per kg of body weight daily to stay healthy.</TText>
        </TView>

        <TPressable onPress={() => go('vet')} className="flex-row items-center gap-3 bg-card border border-red-line rounded-2xl p-3">
          <MaterialCommunityIcons name="hospital-building" size={24} color={colors.red} />
          <TView className="flex-1">
            <TText className="text-base font-medium text-text">Emergency or clinic help</TText>
            <TText className="text-2xs text-dim">Call, email, or open a nearby vet map</TText>
          </TView>
          <Ionicons name="chevron-forward" size={18} color={colors.dim} />
        </TPressable>
      </TScrollView>
    </AppFrame>
  );
}

function Chat({ screen, go, user, messages, setMessages, onDiagnose }) {
  const [selected, setSelected] = useState(['Vomiting', 'Diarrhea']);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const petName = user.pet?.name || 'your dog';

  function toggleSymptom(symptom) {
    setSelected((current) => (current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]));
  }

  async function sendMessage(text = message) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessage('');
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    try {
      const result = await api.chat(trimmed);
      setMessages((current) => [...current, { role: 'bot', text: result.reply }]);
    } catch (err) {
      setMessages((current) => [...current, { role: 'bot', text: err.message }]);
    }
  }

  async function diagnose() {
    if (!user.pet) {
      setMessages((current) => [...current, { role: 'bot', text: 'Please add a dog profile before running a diagnosis.' }]);
      return;
    }
    setLoading(true);
    try {
      const result = await api.diagnose(selected);
      onDiagnose(result.diagnosis, result.history);
      go('diagnosis');
    } catch (err) {
      setMessages((current) => [...current, { role: 'bot', text: err.message }]);
    } finally {
      setLoading(false);
    }
  }

  async function predictWithModel() {
    const symptomsText = message.trim() || selected.join(', ');
    if (!user.pet) {
      setMessages((current) => [...current, { role: 'bot', text: 'Please add a dog profile before running a model prediction.' }]);
      return;
    }
    if (!symptomsText) {
      setMessages((current) => [...current, { role: 'bot', text: 'Enter symptoms first, for example: vomiting and diarrhea.' }]);
      return;
    }

    setMessage('');
    setModelLoading(true);
    setMessages((current) => [...current, { role: 'user', text: symptomsText }]);
    try {
      const result = await api.predictDisease(symptomsText);
      onDiagnose(result.diagnosis, result.history);
      go('diagnosis');
    } catch (err) {
      setMessages((current) => [...current, { role: 'bot', text: err.message }]);
    } finally {
      setModelLoading(false);
    }
  }

  return (
    <AppFrame nav active={screen} go={go}>
      <TView className="flex-1">
        <TView className="flex-row items-center gap-2 px-4 pt-5 pb-3 border-b border-line">
          <TPressable onPress={() => go('dashboard')}>
            <Ionicons name="chevron-back" size={24} color={colors.sub} />
          </TPressable>
          <TView className="w-10 h-10 rounded-full bg-green-soft border border-green-line items-center justify-center">
            <MaterialCommunityIcons name="paw" size={19} color={colors.green} />
          </TView>
          <TView className="flex-1">
            <TText className="text-base font-bold text-text">Ziva AI</TText>
            <TView className="flex-row items-center gap-1">
              <TView className="w-1.5 h-1.5 bg-green rounded-full" />
              <TText className="text-2xs text-green">Online</TText>
            </TView>
          </TView>
          <TPressable onPress={() => go('history')} className="bg-card border border-line rounded-full px-3 py-1">
            <TText className="text-xs text-sub">History</TText>
          </TPressable>
        </TView>

        <TScrollView className="flex-1" contentContainerStyle={styles.messages}>
          {messages.map((item, index) =>
            item.role === 'bot' ? <BotBubble key={`${item.text}-${index}`}>{item.text}</BotBubble> : <UserBubble key={`${item.text}-${index}`}>{item.text}</UserBubble>,
          )}

          <TView className="bg-muted rounded-2xl p-3 gap-2">
            <TText className="text-xs text-sub font-medium">{`Select symptoms for ${petName}:`}</TText>
            <TView className="flex-row flex-wrap gap-1.5">
              {symptomOptions.map((item) => {
                const active = selected.includes(item);
                return (
                  <TPressable key={item} onPress={() => toggleSymptom(item)} className={`px-2 py-1.5 border rounded-full ${active ? 'bg-green border-green' : 'border-green-line'}`}>
                    <TText className={`text-xs ${active ? 'text-black font-bold' : 'text-dim'}`}>{item}</TText>
                  </TPressable>
                );
              })}
            </TView>
          <TPressable onPress={diagnose} className="bg-green rounded-lg py-2">
            <TText className="text-black text-center text-xs font-bold">
              {loading ? 'Checking...' : `Confirm ${selected.length} symptoms`}
            </TText>
          </TPressable>
          <TPressable onPress={predictWithModel} className="border border-green-line rounded-lg py-2">
            <TText className="text-green text-center text-xs font-bold">
              {modelLoading ? 'Predicting...' : 'Predict with model'}
            </TText>
          </TPressable>
        </TView>
        </TScrollView>

        <TView className="flex-row gap-2 px-4 py-2 border-t border-line">
          {['Yes, fever too', 'No, just those'].map((reply) => (
            <TPressable key={reply} onPress={() => sendMessage(reply)} className="px-3 py-1.5 rounded-full border border-green-line">
              <TText className="text-xs text-green">{reply}</TText>
            </TPressable>
          ))}
        </TView>
        <TView className="flex-row items-center gap-2 px-4 pb-3">
          <TTextInput
            value={message}
            onChangeText={setMessage}
            placeholder={`Describe ${petName}'s symptoms...`}
            placeholderTextColor={colors.dim}
            className="flex-1 bg-card border border-line rounded-full px-3 py-2 text-xs text-sub"
          />
          <TPressable onPress={() => sendMessage()} className="w-9 h-9 bg-green rounded-full items-center justify-center">
            <Ionicons name="arrow-up" size={18} color={colors.black} />
          </TPressable>
        </TView>
      </TView>
    </AppFrame>
  );
}

function BotBubble({ children }) {
  return (
    <TView className="flex-row items-end gap-2">
      <TView className="w-7 h-7 rounded-full bg-green-soft border border-green-line items-center justify-center">
        <MaterialCommunityIcons name="paw" size={13} color={colors.green} />
      </TView>
      <TText className="bg-card text-text text-xs leading-5 rounded-3xl p-3" style={styles.bubble}>{children}</TText>
    </TView>
  );
}

function UserBubble({ children }) {
  return <TText className="self-end bg-green text-black text-xs leading-5 rounded-3xl p-3" style={styles.bubble}>{children}</TText>;
}

function Diagnosis({ go, diagnosis }) {
  // if (!diagnosis) return <Dashboard screen="dashboard" go={go} user={fallbackUser} history={[]} />;

  return (
    <AppFrame>
      <TScrollView className="flex-1" contentContainerStyle={styles.content}>
        <TView className="flex-row justify-between items-center">
          <TPressable onPress={() => go('chat')}>
            <Ionicons name="chevron-back" size={24} color={colors.sub} />
          </TPressable>
          <TText className="text-lg font-bold text-text">Diagnosis result</TText>
          <TText className="text-sm text-green">Saved</TText>
        </TView>

        <TView className="bg-card border border-green-line rounded-3xl p-4 gap-3">
          <TView className="flex-row items-center gap-3">
            <TView className="w-12 h-12 rounded-full bg-green-soft items-center justify-center">
              <MaterialCommunityIcons name="microscope" size={26} color={colors.green} />
            </TView>
            <TView className="flex-1">
              <TText className="text-2xs text-dim uppercase">{`${diagnosis.petName}'s diagnosis`}</TText>
              <TText className="text-xl font-extrabold text-green">{diagnosis.illness}</TText>
              <TText className="text-xs text-dim">{diagnosis.confidence}% match - {diagnosis.symptoms.length} symptoms</TText>
            </TView>
          </TView>
          <TView>
            <TView className="flex-row justify-between items-center">
              <TText className="text-xs text-dim">Severity</TText>
              <TView className="bg-red-soft rounded-md px-2 py-1">
                <TText className={`text-xs font-bold ${diagnosis.severity === 'High' ? 'text-red' : 'text-green'}`}>{diagnosis.severity}</TText>
              </TView>
            </TView>
            <TView className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
              <TView className="h-1 rounded-full" style={{ width: `${diagnosis.confidence}%`, backgroundColor: diagnosis.severity === 'High' ? colors.red : colors.green }} />
            </TView>
          </TView>
          <TText className="text-xs text-dim leading-5">{diagnosis.description}</TText>
        </TView>

        <TView className="flex-row flex-wrap gap-1.5">
          {diagnosis.symptoms.map((item) => (
            <TView key={item} className="bg-green-soft rounded-full px-3 py-1">
              <TText className="text-2xs text-green">{item}</TText>
            </TView>
          ))}
        </TView>

        <AdviceCard steps={diagnosis.advice} />

        <TPressable onPress={() => go('vet')} className="flex-row gap-2 bg-green-soft border border-green-line rounded-2xl p-3">
          <MaterialCommunityIcons name="hospital-building" size={24} color={colors.green} />
          <TView className="flex-1">
            <TText className="text-base font-bold text-green">Vet recommendation</TText>
            <TText className="text-xs text-dim mt-1">{diagnosis.vetMessage}</TText>
          </TView>
          <Ionicons name="chevron-forward" size={18} color={colors.green} />
        </TPressable>
      </TScrollView>
    </AppFrame>
  );
}

function AdviceCard({ steps }) {
  return (
    <TView className="bg-card border border-line rounded-2xl p-3 gap-2">
      <TView className="flex-row items-center gap-2">
        <Ionicons name="water-outline" size={18} color={colors.blue} />
        <TText className="text-sm text-text font-medium">First-aid steps</TText>
      </TView>
      {steps.map((step) => (
        <TView key={step} className="flex-row gap-2 items-start">
          <TView className="w-1.5 h-1.5 rounded-full bg-green mt-2" />
          <TText className="flex-1 text-xs text-dim leading-5">{step}</TText>
        </TView>
      ))}
    </TView>
  );
}

function History({ screen, go, history }) {
  const highCount = history.filter((item) => item.severity === 'High').length;
  const resolvedCount = history.filter((item) => item.status === 'Resolved').length;

  return (
    <AppFrame nav active={screen} go={go}>
      <TScrollView className="flex-1" contentContainerStyle={styles.contentWithNav}>
        <TView className="flex-row justify-between items-start">
          <TView>
            <TText className="text-xl font-extrabold text-text">Health history</TText>
            <TText className="text-xs text-dim mt-1">All past diagnoses from the API</TText>
          </TView>
          <TPressable onPress={() => go('chat')} className="bg-green rounded-xl px-3 py-2">
            <TText className="text-black text-sm font-bold">+ New</TText>
          </TPressable>
        </TView>

        <TView className="flex-row gap-2">
          <Stat number={String(history.length)} label="Total" color={colors.text} />
          <Stat number={String(highCount)} label="High" color={colors.red} />
          <Stat number={String(resolvedCount)} label="Resolved" color={colors.green} />
        </TView>

        {history.map((record) => (
          <HistoryItem key={record.id} record={record} />
        ))}
      </TScrollView>
    </AppFrame>
  );
}

function HistoryItem({ record }) {
  const color = record.severity === 'High' ? colors.red : record.severity === 'Medium' ? colors.amber : colors.green;

  return (
    <TView className="flex-row gap-2 bg-card border border-line rounded-2xl p-3">
      <TView className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: color }} />
      <TView className="flex-1">
        <TText className="text-base font-medium text-text">{record.illness}</TText>
        <TText className="text-2xs text-dim mt-1">{record.date}</TText>
        <TView className="flex-row flex-wrap gap-1 mt-1">
          {record.symptoms.map((chip) => (
            <TView key={chip} className="bg-muted rounded-md px-2 py-1">
              <TText className="text-2xs text-dim">{chip}</TText>
            </TView>
          ))}
        </TView>
        <TView className="flex-row justify-between mt-2">
          <TText className="text-2xs font-medium" style={{ color }}>{record.status}</TText>
          <TText className="text-2xs text-dim">{record.confidence}% match</TText>
        </TView>
      </TView>
      <Ionicons name="chevron-forward" size={18} color={colors.dim} />
    </TView>
  );
}

function Stat({ number, label, color }) {
  return (
    <TView className="flex-1 bg-card border border-line rounded-xl p-3 items-center">
      <TText className="text-2xl font-bold" style={{ color }}>{number}</TText>
      <TText className="text-2xs text-dim">{label}</TText>
    </TView>
  );
}

function Appointments({ screen, go, user, appointments, onBookAppointment }) {
  const [form, setForm] = useState({
    petId: user.pet?.id || user.pets[0]?.id || '',
    reason: 'Diagnosis follow-up',
    date: '',
    time: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function book() {
    setError('');
    setSaving(true);
    try {
      await onBookAppointment(form);
      setForm((current) => ({ ...current, reason: 'Diagnosis follow-up', date: '', time: '', notes: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFrame nav active={screen} go={go}>
      <TScrollView className="flex-1" contentContainerStyle={styles.contentWithNav}>
        <TView className="flex-row justify-between items-center">
          <TView>
            <TText className="text-xl font-extrabold text-text">Appointments</TText>
            <TText className="text-xs text-dim mt-1">Book a vet visit and track status</TText>
          </TView>
          {user.role === 'admin' ? (
            <TPressable onPress={() => go('admin')} className="bg-green rounded-xl px-3 py-2">
              <TText className="text-black text-xs font-bold">Admin</TText>
            </TPressable>
          ) : null}
        </TView>

        <TView className="bg-card border border-line rounded-2xl p-3 gap-3">
          <SectionLabel>Book appointment</SectionLabel>
          {user.pets.length ? (
            <TScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TView className="flex-row gap-2">
                {user.pets.map((pet) => {
                  const selected = form.petId === pet.id;
                  return (
                    <TPressable key={pet.id} onPress={() => update('petId', pet.id)} className={`border rounded-full px-3 py-2 ${selected ? 'bg-green border-green' : 'border-green-line'}`}>
                      <TText className={`text-xs font-bold ${selected ? 'text-black' : 'text-green'}`}>{pet.name}</TText>
                    </TPressable>
                  );
                })}
              </TView>
            </TScrollView>
          ) : (
            <TText className="text-xs text-dim leading-5">Add a dog profile before booking an appointment.</TText>
          )}
          <Field label="Reason" value={form.reason} onChangeText={(text) => update('reason', text)} />
          <TView className="flex-row gap-2">
            <TView className="flex-1">
              <Field label="Date" value={form.date} onChangeText={(text) => update('date', text)} placeholder="YYYY-MM-DD" />
            </TView>
            <TView className="flex-1">
              <Field label="Time" value={form.time} onChangeText={(text) => update('time', text)} placeholder="10:00 AM" />
            </TView>
          </TView>
          <Field label="Notes" value={form.notes} onChangeText={(text) => update('notes', text)} multiline />
          {error ? <TText className="text-red text-xs">{error}</TText> : null}
          <TPressable onPress={book} className="bg-green rounded-xl py-3">
            <TText className="text-black text-center text-base font-extrabold">{saving ? 'Booking...' : 'Request appointment'}</TText>
          </TPressable>
        </TView>

        <SectionLabel>Your appointments</SectionLabel>
        {appointments.length ? appointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        )) : (
          <TView className="bg-card border border-line rounded-2xl p-4">
            <TText className="text-sm text-dim">No appointments yet.</TText>
          </TView>
        )}
      </TScrollView>
    </AppFrame>
  );
}

function AdminAppointments({ appointments, onUpdateAppointment, onLogout }) {
  const [notes, setNotes] = useState({});
  const [savingId, setSavingId] = useState('');
  const pending = appointments.filter((appointment) => appointment.status === 'pending');
  const confirmed = appointments.filter((appointment) => appointment.status === 'confirmed');
  const completed = appointments.filter((appointment) => appointment.status === 'completed');
  const cancelled = appointments.filter((appointment) => appointment.status === 'cancelled');
  const today = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter((appointment) => appointment.date === today);

  async function update(appointment, status) {
    setSavingId(appointment.id);
    try {
      await onUpdateAppointment(appointment.id, status, notes[appointment.id] || appointment.vetNote || '');
    } finally {
      setSavingId('');
    }
  }

  return (
    <AppFrame>
      <TScrollView className="flex-1" contentContainerStyle={styles.content}>
        <TView className="flex-row justify-between items-center">
          <TView className="w-20" />
          <TText className="text-lg font-bold text-text">Vet dashboard</TText>
          <TPressable onPress={onLogout} className="flex-row items-center gap-1 border border-line rounded-full px-3 py-2">
            <Ionicons name="log-out-outline" size={16} color={colors.sub} />
            <TText className="text-xs font-bold text-sub">Sign out</TText>
          </TPressable>
        </TView>

        <TView className="bg-green-soft border border-green-line rounded-3xl p-4 gap-2">
          <MaterialCommunityIcons name="stethoscope" size={30} color={colors.green} />
          <TText className="text-xl font-extrabold text-green">Ziva clinic operations</TText>
          <TText className="text-xs text-dim leading-5">Review booking requests, confirm visits, record vet notes, and close completed appointments.</TText>
        </TView>

        <TView className="flex-row flex-wrap gap-2">
          <AdminStat label="Pending" value={pending.length} color={colors.amber} />
          <AdminStat label="Confirmed" value={confirmed.length} color={colors.green} />
          <AdminStat label="Today" value={todayAppointments.length} color={colors.blue} />
          <AdminStat label="Completed" value={completed.length} color={colors.sub} />
        </TView>

        <SectionLabel>Pending requests</SectionLabel>
        {pending.length ? pending.map((appointment) => (
          <AdminAppointmentPanel
            key={appointment.id}
            appointment={appointment}
            note={notes[appointment.id] ?? appointment.vetNote ?? ''}
            onNote={(text) => setNotes((current) => ({ ...current, [appointment.id]: text }))}
            onUpdate={update}
            saving={savingId === appointment.id}
          />
        )) : (
          <TView className="bg-card border border-line rounded-2xl p-4">
            <TText className="text-sm text-dim">No pending requests right now.</TText>
          </TView>
        )}

        <SectionLabel>Confirmed and upcoming</SectionLabel>
        {[...confirmed, ...todayAppointments.filter((appointment) => appointment.status !== 'confirmed')].length ? (
          [...confirmed, ...todayAppointments.filter((appointment) => appointment.status !== 'confirmed')].map((appointment) => (
            <AdminAppointmentPanel
              key={appointment.id}
              appointment={appointment}
              note={notes[appointment.id] ?? appointment.vetNote ?? ''}
              onNote={(text) => setNotes((current) => ({ ...current, [appointment.id]: text }))}
              onUpdate={update}
              saving={savingId === appointment.id}
            />
          ))
        ) : (
          <TView className="bg-card border border-line rounded-2xl p-4">
            <TText className="text-sm text-dim">No confirmed appointments yet.</TText>
          </TView>
        )}

        <SectionLabel>Recent records</SectionLabel>
        {appointments.length ? appointments.slice(0, 6).map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        )) : (
          <TView className="bg-card border border-line rounded-2xl p-4">
            <TText className="text-sm text-dim">No appointment records yet.</TText>
          </TView>
        )}

        {cancelled.length ? <TText className="text-xs text-dim text-center">{cancelled.length} cancelled appointment(s)</TText> : null}
      </TScrollView>
    </AppFrame>
  );
}

function AdminStat({ label, value, color }) {
  return (
    <TView className="bg-card border border-line rounded-2xl p-3" style={styles.adminStat}>
      <TText className="text-2xl font-extrabold" style={{ color }}>{value}</TText>
      <TText className="text-xs text-dim mt-1">{label}</TText>
    </TView>
  );
}

function AdminAppointmentPanel({ appointment, note, onNote, onUpdate, saving }) {
  return (
    <TView className="bg-card border border-line rounded-2xl p-3 gap-3">
      <AppointmentCard appointment={appointment} />
      <Field label="Vet note" value={note} onChangeText={onNote} />
      <TView className="flex-row gap-2">
        <TPressable onPress={() => onUpdate(appointment, 'confirmed')} className="flex-1 border border-green-line rounded-xl py-2">
          <TText className="text-green text-center text-xs font-bold">{saving ? 'Saving...' : 'Confirm'}</TText>
        </TPressable>
        <TPressable onPress={() => onUpdate(appointment, 'completed')} className="flex-1 border border-green-line rounded-xl py-2">
          <TText className="text-green text-center text-xs font-bold">{saving ? 'Saving...' : 'Done'}</TText>
        </TPressable>
        <TPressable onPress={() => onUpdate(appointment, 'cancelled')} className="flex-1 border border-red-line rounded-xl py-2">
          <TText className="text-red text-center text-xs font-bold">{saving ? 'Saving...' : 'Cancel'}</TText>
        </TPressable>
      </TView>
    </TView>
  );
}

function AppointmentCard({ appointment }) {
  const statusColor = appointment.status === 'confirmed' || appointment.status === 'completed'
    ? colors.green
    : appointment.status === 'cancelled'
      ? colors.red
      : colors.amber;

  return (
    <TView className="bg-card border border-line rounded-2xl p-3 gap-2">
      <TView className="flex-row justify-between items-start">
        <TView className="flex-1">
          <TText className="text-base font-bold text-text">{appointment.petName}</TText>
          <TText className="text-xs text-dim mt-1">{appointment.reason}</TText>
        </TView>
        <TView className="items-end gap-1">
          <TText className="text-xs font-bold" style={{ color: statusColor }}>{appointment.status}</TText>
        </TView>
      </TView>
      <TText className="text-xs text-sub">{appointment.date} at {appointment.time}</TText>
      <TText className="text-xs text-dim">{appointment.ownerName} · {appointment.ownerEmail}</TText>
      {appointment.notes ? <TText className="text-xs text-dim leading-5">Note: {appointment.notes}</TText> : null}
      {appointment.vetNote ? <TText className="text-xs text-green leading-5">Vet note: {appointment.vetNote}</TText> : null}
    </TView>
  );
}

function Profile({ screen, go, user, onLogout, onAddPet, onSelectPet, onUpdateProfile, onUpdatePet, onDeletePet }) {
  const pet = user.pet;
  const [newPet, setNewPet] = useState({ name: '', breed: '', age: '', weight: '' });
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user.name, phone: user.phone || '' });
  const [petForm, setPetForm] = useState({
    name: pet?.name || '',
    breed: pet?.breed || '',
    age: pet?.age || '',
    weight: pet?.weight || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function updatePet(field, value) {
    setNewPet((current) => ({ ...current, [field]: value }));
  }

  function startEditing() {
    setError('');
    setProfileForm({ name: user.name, phone: user.phone || '' });
    setPetForm({ name: pet?.name || '', breed: pet?.breed || '', age: pet?.age || '', weight: pet?.weight || '' });
    setEditing(true);
  }

  function cancelEditing() {
    setError('');
    setEditing(false);
  }

  async function saveProfile() {
    setError('');
    if (!profileForm.name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (pet && (!petForm.name.trim() || !petForm.breed.trim() || !petForm.age.trim() || !petForm.weight.trim())) {
      setError('Complete all active dog fields.');
      return;
    }

    setSaving(true);
    try {
      await onUpdateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });
      if (pet) {
        await onUpdatePet(pet.id, {
          name: petForm.name.trim(),
          breed: petForm.breed.trim(),
          age: petForm.age.trim(),
          weight: petForm.weight.trim(),
        });
      }
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addPet() {
    setError('');
    if (!newPet.name.trim() || !newPet.breed.trim() || !newPet.age.trim() || !newPet.weight.trim()) {
      setError('Complete all dog fields before adding.');
      return;
    }

    setSaving(true);
    try {
      await onAddPet({
        name: newPet.name.trim(),
        breed: newPet.breed.trim(),
        age: newPet.age.trim(),
        weight: newPet.weight.trim(),
      });
      setNewPet({ name: '', breed: '', age: '', weight: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePet(petId) {
    setError('');
    if (confirmDeleteId !== petId) {
      setConfirmDeleteId(petId);
      return;
    }

    setSaving(true);
    try {
      await onDeletePet(petId);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppFrame nav active={screen} go={go}>
      <TScrollView className="flex-1" contentContainerStyle={styles.contentWithNav}>
        <TView className="flex-row justify-between items-center">
          <TPressable onPress={() => go('dashboard')}>
            <Ionicons name="chevron-back" size={24} color={colors.sub} />
          </TPressable>
          <TText className="text-lg font-bold text-text">My profile</TText>
          {editing ? (
            <TPressable onPress={cancelEditing}>
              <TText className="text-sm text-red">Cancel</TText>
            </TPressable>
          ) : (
            <TPressable onPress={startEditing}>
              <TText className="text-sm text-green">Edit</TText>
            </TPressable>
          )}
        </TView>

        <TView className="items-center gap-1">
          <TView className="w-16 h-16 rounded-full bg-green items-center justify-center">
            <TText className="text-black text-3xl font-extrabold">{initials(user.name)}</TText>
          </TView>
          <TText className="text-xl font-bold text-text mt-1">{user.name}</TText>
          <TText className="text-sm text-dim">{user.email}</TText>
        </TView>

        {editing ? (
          <TView>
            <SectionLabel>Edit personal details</SectionLabel>
            <TView className="bg-card border border-line rounded-2xl p-3 gap-3">
              <Field label="Full name" value={profileForm.name} onChangeText={(text) => setProfileForm((current) => ({ ...current, name: text }))} />
              <Field label="Phone" value={profileForm.phone} onChangeText={(text) => setProfileForm((current) => ({ ...current, phone: text }))} />
              <InfoRow label="Email" value={user.email} />
            </TView>
          </TView>
        ) : (
          <Details title="Personal details" rows={[['Full name', user.name], ['Email', user.email], ['Phone', user.phone || 'Not added']]} />
        )}

        <TView>
          <SectionLabel>Dogs</SectionLabel>
          <TView className="gap-2">
            {user.pets.map((item) => {
              const selected = item.id === user.activePetId;
              const confirming = confirmDeleteId === item.id;
              return (
                <TView key={item.id} className={`border rounded-2xl p-3 gap-3 ${selected ? 'bg-green-soft border-green-line' : 'bg-card border-line'}`}>
                  <TPressable onPress={() => onSelectPet(item.id)} className="flex-row items-center gap-3">
                  <TView className="w-11 h-11 bg-green-soft rounded-xl items-center justify-center">
                    <MaterialCommunityIcons name="dog" size={25} color={colors.green} />
                  </TView>
                  <TView className="flex-1">
                    <TText className="text-base font-bold text-text">{item.name}</TText>
                    <TText className="text-xs text-dim">{item.breed} - {item.age} - {item.weight}</TText>
                  </TView>
                  <TView className="items-center gap-2">
                    {selected ? <TText className="text-2xs text-green font-bold">Active</TText> : null}
                    <TPressable onPress={() => deletePet(item.id)} className="w-8 h-8 rounded-full border border-red-line items-center justify-center">
                      <Ionicons name="trash-outline" size={16} color={colors.red} />
                    </TPressable>
                  </TView>
                  </TPressable>
                  {confirming ? <TView className="flex-row gap-2">
                    {confirming ? (
                      <TPressable onPress={() => setConfirmDeleteId(null)} className="flex-1 border border-green-line rounded-xl py-2">
                        <TText className="text-green text-center text-xs font-bold">Cancel</TText>
                      </TPressable>
                    ) : null}
                    <TPressable onPress={() => deletePet(item.id)} className="flex-1 flex-row items-center justify-center gap-1 border border-red-line rounded-xl py-2">
                      <TText className="text-red text-center text-xs font-bold">
                        {saving ? 'Removing...' : 'Confirm delete'}
                      </TText>
                    </TPressable>
                  </TView> : null}
                </TView>
              );
            })}
          </TView>
        </TView>

        <TView>
          <SectionLabel>{editing ? 'Edit active dog' : 'Active dog details'}</SectionLabel>
          <TView className={`bg-card border border-line rounded-2xl ${editing ? 'p-3 gap-3' : 'overflow-hidden'}`}>
            {editing && pet ? (
              <>
                <Field label="Dog name" value={petForm.name} onChangeText={(text) => setPetForm((current) => ({ ...current, name: text }))} />
                <Field label="Breed" value={petForm.breed} onChangeText={(text) => setPetForm((current) => ({ ...current, breed: text }))} />
                <TView className="flex-row gap-2">
                  <TView className="flex-1">
                    <Field label="Age" value={petForm.age} onChangeText={(text) => setPetForm((current) => ({ ...current, age: text }))} />
                  </TView>
                  <TView className="flex-1">
                    <Field label="Weight" value={petForm.weight} onChangeText={(text) => setPetForm((current) => ({ ...current, weight: text }))} />
                  </TView>
                </TView>
              </>
            ) : pet ? (
              <>
                <TView className="flex-row items-center gap-3 p-3">
                  <TView className="w-11 h-11 bg-green-soft rounded-xl items-center justify-center">
                    <MaterialCommunityIcons name="dog" size={25} color={colors.green} />
                  </TView>
                  <TText className="text-lg font-bold text-text">{pet.name}</TText>
                </TView>
                <InfoRow label="Breed" value={pet.breed} />
                <InfoRow label="Age" value={pet.age} />
                <InfoRow label="Weight" value={pet.weight} />
              </>
            ) : (
              <TView className="p-3">
                <TText className="text-sm text-dim leading-5">No active dog profile. Add a dog below when you are ready.</TText>
              </TView>
            )}
          </TView>
        </TView>

        {editing ? (
          <TPressable onPress={saveProfile} className="bg-green rounded-xl py-3">
            <TText className="text-black text-center text-base font-extrabold">{saving ? 'Saving...' : 'Save changes'}</TText>
          </TPressable>
        ) : null}

        {!editing ? (
          <TView>
            <SectionLabel>Add another dog</SectionLabel>
            <TView className="bg-card border border-line rounded-2xl p-3 gap-3">
              <Field label="Dog name" value={newPet.name} onChangeText={(text) => updatePet('name', text)} />
              <Field label="Breed" value={newPet.breed} onChangeText={(text) => updatePet('breed', text)} />
              <TView className="flex-row gap-2">
                <TView className="flex-1">
                  <Field label="Age" value={newPet.age} onChangeText={(text) => updatePet('age', text)} />
                </TView>
                <TView className="flex-1">
                  <Field label="Weight" value={newPet.weight} onChangeText={(text) => updatePet('weight', text)} />
                </TView>
              </TView>
              {error ? <TText className="text-red text-xs">{error}</TText> : null}
              <TPressable onPress={addPet} className="bg-green rounded-xl py-3">
                <TText className="text-black text-center text-base font-extrabold">{saving ? 'Saving...' : 'Add dog'}</TText>
              </TPressable>
            </TView>
          </TView>
        ) : error ? <TText className="text-red text-xs">{error}</TText> : null}

        <TPressable onPress={onLogout} className="bg-card border border-red-line rounded-2xl py-3">
          <TText className="text-red text-center text-base font-medium">Sign out</TText>
        </TPressable>
      </TScrollView>
    </AppFrame>
  );
}

function VetContact({ go, user }) {
  const petName = user.pet?.name || 'my dog';
  const message = `Hello Ziva Pet World, I need veterinary support for ${petName}.`;
  const mailSubject = encodeURIComponent(`Vet support for ${petName}`);
  const mailBody = encodeURIComponent(message);

  function openNearbyVets() {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('veterinary clinics near me')}`);
  }

  const actions = [
    {
      icon: 'call-outline',
      title: 'Call clinic line',
      subtitle: '+234 801 234 5678',
      onPress: () => Linking.openURL('tel:+2348012345678'),
    },
    {
      icon: 'mail-outline',
      title: 'Email support',
      subtitle: 'care@zivapetworld.com',
      onPress: () => Linking.openURL(`mailto:care@zivapetworld.com?subject=${mailSubject}&body=${mailBody}`),
    },
    {
      icon: 'map-outline',
      title: 'Find vet nearby',
      subtitle: 'Open Maps to see nearby vet contacts and directions',
      onPress: openNearbyVets,
    },
  ];

  return (
    <AppFrame nav active="vet" go={go}>
      <TScrollView className="flex-1" contentContainerStyle={styles.contentWithNav}>
        <TView className="flex-row justify-between items-center">
          <TPressable onPress={() => go('dashboard')}>
            <Ionicons name="chevron-back" size={24} color={colors.sub} />
          </TPressable>
          <TText className="text-lg font-bold text-text">Vet contact</TText>
          <TView className="w-6" />
        </TView>

        <TView className="bg-green-soft border border-green-line rounded-3xl p-4 gap-2">
          <MaterialCommunityIcons name="hospital-building" size={30} color={colors.green} />
          <TText className="text-xl font-extrabold text-green">Need help for {petName}?</TText>
          <TText className="text-xs text-dim leading-5">
            Contact Ziva support or find nearby veterinary clinics with phone numbers, addresses, and directions in Maps.
          </TText>
        </TView>

        {actions.map((action) => (
          <TPressable key={action.title} onPress={action.onPress} className="flex-row items-center gap-3 bg-card border border-line rounded-2xl p-4">
            <TView className="w-11 h-11 bg-green-soft rounded-xl items-center justify-center">
              <Ionicons name={action.icon} size={22} color={colors.green} />
            </TView>
            <TView className="flex-1">
              <TText className="text-base font-bold text-text">{action.title}</TText>
              <TText className="text-xs text-dim mt-1">{action.subtitle}</TText>
            </TView>
            <Ionicons name="open-outline" size={18} color={colors.dim} />
          </TPressable>
        ))}

      </TScrollView>
    </AppFrame>
  );
}

function Details({ title, rows }) {
  return (
    <TView>
      <SectionLabel>{title}</SectionLabel>
      <TView className="bg-card border border-line rounded-2xl overflow-hidden">
        {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
      </TView>
    </TView>
  );
}

function InfoRow({ label, value }) {
  return (
    <TView className="flex-row items-center border-t border-line px-3 py-3">
      <TText className="text-xs text-dim" style={{ width: 96 }}>{label}</TText>
      <TText className="flex-1 text-xs text-text" style={{ textAlign: 'right' }}>{value}</TText>
    </TView>
  );
}

function SectionLabel({ children }) {
  return <TText className="text-2xs text-dim uppercase font-bold mt-1">{children}</TText>;
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function firstName(name) {
  return name.split(' ')[0];
}

export default function ZivaApp() {
  const [screen, setScreen] = useState('splash');
  const [themeMode, setThemeMode] = useState('dark');
  const [user, setUser] = useState();
  const [authReady, setAuthReady] = useState(false);
  const [history, setHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [messages, setMessages] = useState(() => [
    { role: 'bot', text: "Hi! I'm Ziva. Sign in, then tell me what symptoms your pet is showing." },
  ]);

  const authed = useMemo(() => Boolean(user?.id), [user]);

  useEffect(() => {
    const unsubscribe = api.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthReady(true);
        return;
      }

      try {
        const result = await api.authResult(firebaseUser);
        setUser(result.user);
        setHistory(result.history || []);
        setAppointments(result.appointments || []);
        setAdminAppointments(result.adminAppointments || []);
        setScreen(result.user.role === 'admin' ? 'admin' : 'dashboard');
      } finally {
        setAuthReady(true);
      }
    });

    return unsubscribe;
  }, []);

  function handleAuth(nextUser, nextHistory, nextAppointments = [], nextAdminAppointments = []) {
    setUser(nextUser);
    setHistory(nextHistory);
    setAppointments(nextAppointments);
    setAdminAppointments(nextAdminAppointments);
    setMessages([{ role: 'bot', text: nextUser.pet ? `Hi ${firstName(nextUser.name)}. I have ${nextUser.pet.name}'s profile ready. What symptoms are you noticing today?` : `Hi ${firstName(nextUser.name)}. Add a dog profile when you are ready.` }]);
  }

  function handleDiagnosis(nextDiagnosis, nextHistory) {
    setDiagnosis(nextDiagnosis);
    setHistory(nextHistory);
  }

  async function addPet(pet) {
    const result = await api.addPet(pet);
    setUser(result.user);
    setHistory(result.history || []);
    setMessages([{ role: 'bot', text: `I added ${result.user.pet.name}. What symptoms are you noticing today?` }]);
  }

  async function selectPet(petId) {
    const result = await api.setActivePet(petId);
    setUser(result.user);
    setHistory(result.history || []);
    setMessages([{ role: 'bot', text: `I switched to ${result.user.pet.name}. What symptoms are you noticing today?` }]);
  }

  async function updateProfile(updates) {
    const result = await api.updateProfile(updates);
    setUser(result.user);
    setHistory(result.history || []);
  }

  async function updatePet(petId, updates) {
    const result = await api.updatePet(petId, updates);
    setUser(result.user);
    setHistory(result.history || []);
    setMessages([{ role: 'bot', text: `I updated ${result.user.pet.name}'s profile. What symptoms are you noticing today?` }]);
  }

  async function deletePet(petId) {
    const result = await api.deletePet(petId);
    setUser(result.user);
    setHistory(result.history || []);
    setMessages([{ role: 'bot', text: result.user.pet ? `I removed that dog profile. I switched to ${result.user.pet.name}. What symptoms are you noticing today?` : 'I removed that dog profile. There are no dog profiles left.' }]);
  }

  async function bookAppointment(appointment) {
    const result = await api.createAppointment(appointment);
    setAppointments(result.appointments || []);
  }

  async function updateAppointment(appointmentId, status, vetNote) {
    const result = await api.updateAppointmentStatus(appointmentId, status, vetNote);
    setAdminAppointments(result.appointments || []);
  }

  async function logout() {
    await api.logout();
    setUser();
    setHistory([]);
    setAppointments([]);
    setAdminAppointments([]);
    setDiagnosis(null);
    setScreen('auth');
  }

  function toggleTheme() {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  let content;
  if (!authReady) {
    content = (
      <AppFrame>
        <TView className="flex-1 items-center justify-center gap-3">
          <PawLogo size={64} />
          <TText className="text-sm text-dim">Loading Ziva...</TText>
        </TView>
      </AppFrame>
    );
  } else if (screen === 'splash') content = <Splash go={setScreen} />;
  else if (screen === 'auth' || !authed) content = <Auth go={setScreen} onAuth={handleAuth} />;
  else if (user.role === 'admin') content = <AdminAppointments appointments={adminAppointments} onUpdateAppointment={updateAppointment} onLogout={logout} />;
  else if (screen === 'chat') content = <Chat screen={screen} go={setScreen} user={user} messages={messages} setMessages={setMessages} onDiagnose={handleDiagnosis} />;
  else if (screen === 'diagnosis') content = <Diagnosis go={setScreen} diagnosis={diagnosis} />;
  else if (screen === 'history') content = <History screen={screen} go={setScreen} history={history} />;
  else if (screen === 'appointments') content = <Appointments screen={screen} go={setScreen} user={user} appointments={appointments} onBookAppointment={bookAppointment} />;
  else if (screen === 'admin') content = <Dashboard screen="dashboard" go={setScreen} user={user} history={history} onSelectPet={selectPet} themeMode={themeMode} onToggleTheme={toggleTheme} />;
  else if (screen === 'vet') content = <VetContact go={setScreen} user={user} />;
  else if (screen === 'profile') {
    content = (
      <Profile
        screen={screen}
        go={setScreen}
        user={user}
        onLogout={logout}
        onAddPet={addPet}
        onSelectPet={selectPet}
        onUpdateProfile={updateProfile}
        onUpdatePet={updatePet}
        onDeletePet={deletePet}
      />
    );
  } else {
    content = <Dashboard screen={screen} go={setScreen} user={user} history={history} onSelectPet={selectPet} themeMode={themeMode} onToggleTheme={toggleTheme} />;
  }

  return <AppThemeProvider mode={themeMode}>{content}</AppThemeProvider>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.black,
  },
  authContent: {
    padding: 20,
    paddingTop: 34,
    gap: 14,
  },
  content: {
    padding: 16,
    paddingTop: 22,
    gap: 12,
  },
  contentWithNav: {
    padding: 16,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 12,
  },
  actionCard: {
    width: '48%',
    minHeight: 96,
  },
  adminStat: {
    width: '48%',
  },
  messages: {
    padding: 14,
    gap: 9,
  },
  bubble: {
    maxWidth: '82%',
  },
});
