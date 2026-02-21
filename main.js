// Supabase Configuration
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let currentUser = null;
let allSurahs = [];
let userLocation = { lat: 23.8103, lng: 90.4125 };
let ramadanTimings = { sehri: '', iftar: '' };
let currentAudio = new Audio();
let isPlaying = false;
let currentAyahList = [];
let currentAyahIndex = -1;
let lastScrollPos = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    initLocation();
    loadSurahs();
    setInterval(updateMealCountdown, 1000);
    initQibla();

    currentAudio.ontimeupdate = () => {
        if (currentAudio.duration) {
            const progress = (currentAudio.currentTime / currentAudio.duration);
            
            // Update Progress Circle
            const circle = document.getElementById('audio-progress-circle');
            if (circle) {
                const offset = 157 - (progress * 157);
                circle.style.strokeDashoffset = offset;
            }
            
            // Update Time Display
            const mins = Math.floor(currentAudio.currentTime / 60);
            const secs = Math.floor(currentAudio.currentTime % 60);
            const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
            const timeEl = document.getElementById('audio-time');
            if (timeEl) timeEl.innerText = timeStr;

            // Auto-Scroll Logic
            handleAutoScroll(progress);
        }
    };
    currentAudio.onended = () => playNextAyah();
});

function handleAutoScroll(progress) {
    const activeCard = document.getElementById(`ayah-card-${currentAyahIndex}`);
    const mainContainer = document.querySelector('main');
    
    if (activeCard && mainContainer) {
        const cardHeight = activeCard.offsetHeight;
        const cardTop = activeCard.offsetTop - 100; 
        const scrollTarget = cardTop + (cardHeight * progress * 0.5); 
        
        mainContainer.scrollTo({
            top: scrollTarget,
            behavior: 'auto'
        });
    }
}

// Auth
async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').classList.add('hidden');
        document.getElementById('user-info').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.email.split('@')[0];
        initTracker();
    }
}

window.openAuthModal = () => document.getElementById('auth-modal').classList.add('active');
window.closeAuthModal = () => document.getElementById('auth-modal').classList.remove('active');

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.reload();
    } catch (e) { alert(e.message); }
}

window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    location.reload();
};

// Navigation
window.showSection = function(sectionId) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${sectionId}-section`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(`nav-${sectionId}`).classList.add('nav-active');

    if (sectionId === 'blood') loadDonors();
    if (sectionId === 'tracker') initTracker();
    
    document.querySelector('main').scrollTop = 0;
};

// Prayer Times
async function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            fetchPrayerTimes();
            initQibla(); // Re-init qibla with real location
        }, () => fetchPrayerTimes());
    } else fetchPrayerTimes();
}

async function fetchPrayerTimes() {
    try {
        const date = new Date().toISOString().split('T')[0];
        const res = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${userLocation.lat}&longitude=${userLocation.lng}&method=2`);
        const data = await res.json();
        const timings = data.data.timings;
        
        ramadanTimings.sehri = timings.Imsak;
        ramadanTimings.iftar = timings.Maghrib;
        
        document.getElementById('sehri-time').innerText = timings.Imsak;
        document.getElementById('iftar-time').innerText = timings.Maghrib;
        document.getElementById('ramadan-date').innerText = data.data.date.hijri.day + ' ' + data.data.date.hijri.month.en + ' ' + data.data.date.hijri.year;

    } catch (e) { console.error(e); }
}

function updateMealCountdown() {
    if (!ramadanTimings.sehri || !ramadanTimings.iftar) return;
    const now = new Date();
    const [sH, sM] = ramadanTimings.sehri.split(':');
    const [iH, iM] = ramadanTimings.iftar.split(':');
    const sehriTime = new Date(); sehriTime.setHours(sH, sM, 0);
    const iftarTime = new Date(); iftarTime.setHours(iH, iM, 0);
    
    let target, label, progress = 0;
    if (now < sehriTime) {
        target = sehriTime; label = 'সেহরির বাকি';
    } else if (now < iftarTime) {
        target = iftarTime; label = 'ইফতারের বাকি';
        progress = ((now - sehriTime) / (iftarTime - sehriTime)) * 100;
    } else {
        target = new Date(sehriTime.getTime() + 24 * 60 * 60 * 1000);
        label = 'আগামী সেহরির বাকি';
    }

    const diff = target - now;
    const hh = Math.floor(diff/3600000); 
    const mm = Math.floor((diff%3600000)/60000); 
    const ss = Math.floor((diff%60000)/1000);
    
    document.getElementById('next-meal-label').innerText = label;
    document.getElementById('meal-countdown').innerText = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    document.getElementById('fasting-progress').style.width = `${progress}%`;
}

// Quran
async function loadSurahs() {
    const res = await fetch('https://api.alquran.cloud/v1/surah');
    const data = await res.json();
    allSurahs = data.data;
    renderSurahs(allSurahs);
}

function renderSurahs(surahs) {
    const list = document.getElementById('surah-list');
    list.innerHTML = surahs.map(s => `
        <div onclick="loadAyahs(${s.number}, '${s.englishName}')" class="glass-card surah-card p-4 flex justify-between items-center cursor-pointer gap-3">
            <div class="flex items-center gap-4 min-w-0">
                <div class="w-10 h-10 flex-shrink-0 premium-gradient text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md">${s.number}</div>
                <div class="truncate">
                    <p class="font-bold text-slate-900 text-sm truncate">${s.englishName}</p>
                    <p class="text-[10px] text-emerald-600 font-bold uppercase">${s.numberOfAyahs} Ayahs</p>
                </div>
            </div>
            <p class="arabic-text text-xl text-emerald-800 flex-shrink-0 font-bold">${s.name}</p>
        </div>
    `).join('');
}

window.filterSurahs = function() {
    const q = document.getElementById('quran-search').value.toLowerCase();
    const filtered = allSurahs.filter(s => s.englishName.toLowerCase().includes(q) || s.name.includes(q));
    renderSurahs(filtered);
};

window.loadAyahs = async function(num, name) {
    document.getElementById('surah-list').classList.add('hidden');
    document.getElementById('quran-search-container').classList.add('hidden');
    document.getElementById('ayah-view').classList.remove('hidden');
    
    const container = document.getElementById('ayah-container');
    container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>';

    const res = await fetch(`https://api.alquran.cloud/v1/surah/${num}/editions/quran-uthmani,bn.bengali`);
    const data = await res.json();
    
    const uthmani = data.data[0].ayahs;
    const bengali = data.data[1].ayahs;

    currentAyahList = uthmani.map((a, i) => ({ number: a.number, surahName: name, index: i }));

    container.innerHTML = uthmani.map((a, i) => `
        <div id="ayah-card-${i}" class="ayah-card glass-card p-5 space-y-4 transition-all duration-300">
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">${num}:${i+1}</span>
                <button onclick="playAyah(${i})" class="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-sm active:scale-90">
                    <i class="fas fa-play text-[10px]"></i>
                </button>
            </div>
            <p class="arabic-text text-xl text-right leading-[2.1] text-slate-900 font-bold">${a.text}</p>
            <div class="border-t border-slate-50 pt-3">
                <p class="text-[13px] text-slate-600 leading-relaxed font-medium">${bengali[i].text}</p>
            </div>
        </div>
    `).join('');
    
    document.querySelector('main').scrollTop = 0;
};

window.backToSurahList = function() {
    document.getElementById('surah-list').classList.remove('hidden');
    document.getElementById('quran-search-container').classList.remove('hidden');
    document.getElementById('ayah-view').classList.add('hidden');
    document.getElementById('global-audio-player').classList.add('hidden');
    currentAudio.pause();
    document.querySelector('main').scrollTop = 0;
};

// Audio Logic
window.playAyah = function(index) {
    currentAyahIndex = index;
    const ayah = currentAyahList[index];
    
    document.querySelectorAll('.ayah-card').forEach(c => c.classList.remove('active-ayah'));
    const activeCard = document.getElementById(`ayah-card-${index}`);
    if (activeCard) {
        activeCard.classList.add('active-ayah');
        const mainContainer = document.querySelector('main');
        mainContainer.scrollTo({
            top: activeCard.offsetTop - 100,
            behavior: 'smooth'
        });
    }

    currentAudio.src = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3`;
    currentAudio.play();
    
    document.getElementById('global-audio-player').classList.remove('hidden');
    document.getElementById('player-surah-name').innerText = `${ayah.surahName} - ${index+1}`;
    document.getElementById('main-play-pause').className = 'fas fa-pause text-sm';
};

window.toggleAudio = function() {
    if (currentAudio.paused) { 
        currentAudio.play(); 
        document.getElementById('main-play-pause').className = 'fas fa-pause text-sm'; 
    } else { 
        currentAudio.pause(); 
        document.getElementById('main-play-pause').className = 'fas fa-play text-sm'; 
    }
};

function playNextAyah() {
    if (currentAyahIndex + 1 < currentAyahList.length) {
        playAyah(currentAyahIndex + 1);
    }
}

// Tracker
async function initTracker() {
    const tasks = [
        { id: 'Fajr', name: 'ফজর' }, 
        { id: 'Dhuhr', name: 'যোহর' }, 
        { id: 'Asr', name: 'আসর' }, 
        { id: 'Maghrib', name: 'মাগরিব' }, 
        { id: 'Isha', name: 'এশা' }
    ];
    
    let completedPrayers = [];
    if (currentUser) {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabaseClient.from('prayer_logs').select('prayer_name').eq('user_id', currentUser.id).eq('date', today);
        if (data) completedPrayers = data.map(d => d.prayer_name);
        
        // Load Monthly Stats
        updateMonthlyStats();
        document.getElementById('monthly-stats-card').classList.remove('hidden');
    } else {
        document.getElementById('monthly-stats-card').classList.add('hidden');
    }

    document.getElementById('tracker-list').innerHTML = tasks.map(t => `
        <div class="glass-card p-5 flex justify-between items-center ${completedPrayers.includes(t.id) ? 'bg-emerald-50/50' : ''}" 
             onclick="handleTrackerClick('${t.id}', ${completedPrayers.includes(t.id)})">
            <span class="font-bold text-slate-900 text-sm">${t.name} নামাজ</span>
            <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${completedPrayers.includes(t.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-200'}">
                ${completedPrayers.includes(t.id) ? '<i class="fas fa-check text-white text-[10px]"></i>' : ''}
            </div>
        </div>
    `).join('');
}

window.handleTrackerClick = function(id, isChecked) {
    if (!currentUser) {
        alert('নামাজ ট্র্যাক করতে দয়া করে লগইন করুন।');
        openAuthModal();
        return;
    }
    togglePrayer(id, !isChecked);
};

window.togglePrayer = async function(prayerName, isChecked) {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    if (isChecked) {
        await supabaseClient.from('prayer_logs').insert({ user_id: currentUser.id, prayer_name: prayerName, date: today });
    } else {
        await supabaseClient.from('prayer_logs').delete().eq('user_id', currentUser.id).eq('prayer_name', prayerName).eq('date', today);
    }
    initTracker();
};

async function updateMonthlyStats() {
    if (!currentUser) return;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const daysPassed = now.getDate();
    
    const { data: monthlyData } = await supabaseClient.from('prayer_logs')
        .select('prayer_name')
        .eq('user_id', currentUser.id)
        .gte('date', startOfMonth);

    if (!monthlyData) return;

    const prayerCounts = {
        'Fajr': 0, 'Dhuhr': 0, 'Asr': 0, 'Maghrib': 0, 'Isha': 0
    };

    monthlyData.forEach(log => {
        if (prayerCounts[log.prayer_name] !== undefined) {
            prayerCounts[log.prayer_name]++;
        }
    });

    const totalExpected = daysPassed * 5;
    const totalPerformed = monthlyData.length;
    const totalMissed = totalExpected - totalPerformed;

    // Find most missed
    let mostMissedName = '--';
    let maxMissedCount = -1;
    
    const bnNames = { 'Fajr': 'ফজর', 'Dhuhr': 'যোহর', 'Asr': 'আসর', 'Maghrib': 'মাগরিব', 'Isha': 'এশা' };

    Object.keys(prayerCounts).forEach(key => {
        const missed = daysPassed - prayerCounts[key];
        if (missed > maxMissedCount) {
            maxMissedCount = missed;
            mostMissedName = bnNames[key];
        }
    });

    document.getElementById('total-missed-count').innerText = totalMissed > 0 ? totalMissed : 0;
    document.getElementById('most-missed-prayer').innerText = totalMissed > 0 ? mostMissedName : 'নেই';
}

// Qibla
function initQibla() {
    const kaaba = { lat: 21.4225, lng: 39.8262 };
    const qiblaDeg = calculateQibla(userLocation.lat, userLocation.lng, kaaba.lat, kaaba.lng);
    document.getElementById('qibla-degree').innerText = `${Math.round(qiblaDeg)}°`;
    
    // Position the Kaaba icon on the dial
    const pointerGroup = document.getElementById('qibla-pointer-group');
    if (pointerGroup) {
        pointerGroup.setAttribute('transform', `rotate(${qiblaDeg}, 100, 100)`);
    }

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientationabsolute', (e) => {
            const compass = e.alpha || e.webkitCompassHeading || 0;
            const dial = document.getElementById('compass-dial');
            const status = document.getElementById('qibla-status');
            
            if (dial) {
                dial.style.transform = `rotate(${-compass}deg)`;
            }

            // Check if aligned with Qibla (within 5 degrees)
            const currentHeading = (360 - compass) % 360;
            const diff = Math.abs(currentHeading - qiblaDeg);
            
            if (diff < 5 || diff > 355) {
                status.innerText = 'সঠিক দিক!';
                status.classList.add('bg-emerald-500', 'text-white');
                status.classList.remove('bg-slate-100', 'text-slate-500');
                document.querySelector('.qibla-dot').classList.add('compass-aligned');
            } else {
                status.innerText = 'কিবলার দিকে ঘুরুন';
                status.classList.remove('bg-emerald-500', 'text-white');
                status.classList.add('bg-slate-100', 'text-slate-500');
                document.querySelector('.qibla-dot').classList.remove('compass-aligned');
            }
        }, true);
    }
}

function calculateQibla(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ), x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Blood
window.loadDonors = async function() {
    const list = document.getElementById('donor-list');
    const group = document.getElementById('blood-filter').value;
    list.innerHTML = '<div class="flex justify-center py-10"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div></div>';
    let query = supabaseClient.from('blood_donors').select('*');
    if (group) query = query.eq('blood_group', group);
    const { data } = await query;
    list.innerHTML = data?.length ? data.map(d => `
        <div class="glass-card p-5 border-l-4 border-red-500 flex justify-between items-center">
            <div>
                <p class="font-bold text-slate-900 text-sm">${d.name} <span class="text-red-600">(${d.blood_group})</span></p>
                <p class="text-[10px] text-slate-500"><i class="fas fa-map-marker-alt mr-1"></i> ${d.location}</p>
            </div>
            <a href="tel:${d.contact}" class="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center"><i class="fas fa-phone text-xs"></i></a>
        </div>
    `).join('') : '<p class="text-center py-10 text-slate-400 text-xs">কোনো দাতা পাওয়া যায়নি।</p>';
};

window.openDonorModal = () => document.getElementById('donor-modal').classList.add('active');
window.closeDonorModal = () => document.getElementById('donor-modal').classList.remove('active');

window.registerDonor = async function() {
    const name = document.getElementById('donor-name').value, group = document.getElementById('donor-group').value, 
          loc = document.getElementById('donor-location').value, contact = document.getElementById('donor-contact').value;
    if (!name || !group || !loc || !contact) return alert('সব তথ্য দিন');
    const { error } = await supabaseClient.from('blood_donors').insert([{ name, blood_group: group, location: loc, contact }]);
    if (error) alert(error.message); else { alert('নিবন্ধিত হয়েছেন'); closeDonorModal(); loadDonors(); }
};