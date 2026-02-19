// Get current date
let currentDate = new Date();
const monthElement = document.getElementById('current-month');
const calendarDaysElement = document.getElementById('calendar-days');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

// Month names
const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Bangladesh Government Holidays with reasons
const bangladeshHolidays = [
    { date: '01-01', reason: 'New Year' },
    { date: '02-21', reason: 'Language Martyrs Day' },
    { date: '03-17', reason: 'Birthday of Sheikh Mujibur Rahman' },
    { date: '03-26', reason: 'Independence Day' },
    { date: '05-01', reason: 'May Day' },
    { date: '08-15', reason: 'National Mourning Day' },
    { date: '12-10', reason: 'Victory Day' },
    { date: '12-16', reason: 'Liberation War Victory' },
    // Religious holidays
    { date: '04-22', reason: 'Shab-e-Barat (Islamic)' },
    { date: '06-28', reason: 'Eid-ul-Fitr (Islamic)' },
    { date: '07-30', reason: 'Eid-al-Adha (Islamic)' },
    { date: '08-20', reason: 'Ashura (Islamic)' },
    { date: '10-18', reason: 'Muharram (Islamic)' },
    { date: '12-25', reason: 'Christmas Day' }
];

// Render calendar
function renderCalendar() {
    // Clear calendar
    calendarDaysElement.innerHTML = '';
    
    // Set month header
    monthElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    // Get first day of month and last day of previous month
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Previous month days
    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'text-center py-2 text-sm calendar-day prev-month';
        dayElement.textContent = prevMonthDays - startingDayOfWeek + i + 1;
        calendarDaysElement.appendChild(dayElement);
    }
    
    // Add days of the current month
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day text-center py-2 cursor-pointer transition-all duration-200 text-sm relative';
        dayElement.textContent = i;
        
        // Check if this date is a Bangladesh holiday
        const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(i).padStart(2, '0');
        const dateKey = `${monthStr}-${dayStr}`;
        
        let holidayReason = null;
        const holiday = bangladeshHolidays.find(h => h.date === dateKey);
        
        if (holiday) {
            holidayReason = holiday.reason;
            dayElement.classList.add('holiday');
            // Add data attribute for tooltip
            dayElement.setAttribute('data-reason', holidayReason);
        }
        
        // Add weekend class for Friday and Saturday (0 = Sunday, 5 = Friday, 6 = Saturday)
        const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            dayElement.classList.add('weekend');
        }
        
        // Highlight today
        const today = new Date();
        if (i === today.getDate() && 
            currentDate.getMonth() === today.getMonth() && 
            currentDate.getFullYear() === today.getFullYear()) {
            dayElement.classList.add('today');
        }
        
        // Add click event
        dayElement.addEventListener('click', (e) => {
            // Remove selected class from all days
            document.querySelectorAll('.calendar-day').forEach(day => {
                day.classList.remove('selected');
            });
            
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            
            // Add ripple effect
            dayElement.classList.add('clicked');
            setTimeout(() => {
                dayElement.classList.remove('clicked');
            }, 600);
        });
        
        // Add hover event for tooltip
        dayElement.addEventListener('mouseenter', (e) => {
            if (holidayReason) {
                showTooltip(e.target, holidayReason);
            }
        });
        
        dayElement.addEventListener('mouseleave', () => {
            hideTooltip();
        });
        
        // Add staggered fade-in animation
        dayElement.style.animationDelay = `${(Math.floor((i-1)/7) * 0.1) + ((i-1)%7) * 0.05}s`;
        dayElement.classList.add('fade-in');
        
        calendarDaysElement.appendChild(dayElement);
    }
}

// Tooltip functions
let tooltipTimeout;

function showTooltip(element, text) {
    // Clear any existing timeout
    clearTimeout(tooltipTimeout);
    
    // Remove any existing tooltips
    hideTooltip();
    
    // Create tooltip after a short delay for better UX
    tooltipTimeout = setTimeout(() => {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip show';
        tooltip.textContent = text;
        
        // Position tooltip near the mouse cursor
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        
        document.body.appendChild(tooltip);
        
        // Adjust position if tooltip goes off-screen
        const tooltipRect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        
        if (tooltipRect.right > windowWidth) {
            tooltip.style.left = `${windowWidth - tooltipRect.width - 10}px`;
        }
        
        if (tooltipRect.left < 0) {
            tooltip.style.left = '10px';
        }
    }, 300); // 300ms delay before showing tooltip
}

function hideTooltip() {
    // Clear timeout to prevent delayed tooltip from appearing
    clearTimeout(tooltipTimeout);
    
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tip => {
        tip.classList.remove('show');
        // Remove after transition completes
        setTimeout(() => {
            if (tip.parentNode) {
                tip.parentNode.removeChild(tip);
            }
        }, 300);
    });
}

// Animated month change
function changeMonth(direction) {
    // Add fade out effect
    calendarDaysElement.classList.add('fade-out');
    
    setTimeout(() => {
        // Change month
        currentDate.setMonth(currentDate.getMonth() + direction);
        
        // Render new calendar
        renderCalendar();
        
        // Remove fade out and add fade in
        calendarDaysElement.classList.remove('fade-out');
        calendarDaysElement.classList.add('month-transition');
        
        // Reset animation class after transition
        setTimeout(() => {
            calendarDaysElement.classList.remove('month-transition');
        }, 500);
    }, 300);
}

// Event listeners for navigation buttons
prevMonthButton.addEventListener('click', () => {
    changeMonth(-1);
});

nextMonthButton.addEventListener('click', () => {
    changeMonth(1);
});

// Initial render
renderCalendar();