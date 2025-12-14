# Float Plan Safety Manager

A comprehensive mobile-first web application for boat owners to manage float plans, track inventory, schedule seasonal maintenance, and ensure safety through check-in notifications.

## 🚢 Features

### Core Functionality
- **Boat Fleet Management** - Add, edit, and manage your vessels with detailed information
- **Float Plan Creation** - Create detailed float plans with route information, crew lists, and check-in schedules
- **Safety Check-Ins** - Set check-in deadlines with grace periods and escalation protocols
- **Emergency Contacts** - Manage notification contacts with email/SMS preferences
- **Inventory Tracking** - Track onboard equipment, supplies, and expiration dates
- **Seasonal Maintenance** - Schedule and track recurring maintenance tasks

### Technical Features
- **Supabase Authentication** - Secure email/password authentication
- **Real-time Data Sync** - Automatic data synchronization across sessions
- **Responsive Design** - Mobile-first design that scales beautifully to desktop
- **Offline-Friendly UI** - Clear status indicators and time-based feedback
- **Production-Ready** - Well-documented, modularized code following best practices

## 🛠️ Tech Stack

- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS v4.0
- **UI Components**: Shadcn/ui component library
- **Backend**: Supabase Edge Functions (Hono framework)
- **Database**: Supabase KV Store
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Notifications**: Sonner (toast notifications)

## 📁 Project Structure

```
/
├── App.tsx                      # Main application component with routing
├── components/
│   ├── AuthScreen.tsx           # Login/signup screen
│   ├── Dashboard.tsx            # Main dashboard with quick actions
│   ├── BoatsManager.tsx         # Boat fleet management
│   ├── CreateFloatPlan.tsx      # Float plan creation/editing form
│   ├── FloatPlanDetail.tsx      # Float plan details and check-in
│   ├── FloatPlansList.tsx       # List of all float plans
│   ├── ContactsManager.tsx      # Emergency contacts management
│   ├── InventoryList.tsx        # Inventory tracking
│   ├── SeasonalTasks.tsx        # Maintenance task scheduler
│   └── ui/                      # Reusable UI components
├── supabase/
│   └── functions/
│       └── server/
│           ├── index.tsx        # API routes and business logic
│           └── kv_store.tsx     # KV store utilities (protected)
├── utils/
│   └── supabase/
│       ├── client.ts            # Supabase client singleton
│       └── info.tsx             # Project configuration
└── styles/
    └── globals.css              # Global styles and theme

```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account (for deployment)
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd float-plan-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Update `/utils/supabase/info.tsx` with your credentials

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open application**
   - Navigate to `http://localhost:5173`
   - Create an account to get started

## 📱 Usage Guide

### Getting Started
1. **Sign Up** - Create an account with email and password
2. **Add Boats** - Navigate to "My Boats" and add your vessels
3. **Create Float Plan** - Select a boat and create your first float plan
4. **Add Contacts** - Set up emergency contacts for notifications
5. **Track Inventory** - Add safety equipment and supplies
6. **Schedule Maintenance** - Create seasonal task checklists

### Creating a Float Plan
1. Click "Create Float Plan" from the dashboard
2. Select a boat from your fleet or enter manually
3. Enter departure point and destination
4. Set check-in deadline and grace period
5. Add crew members
6. Add any additional notes
7. Save as draft or activate immediately

### Managing Check-Ins
- **Active Plans** - Viewable on dashboard with countdown
- **Check In** - Tap "Check In Now" to confirm safety
- **Overdue** - Plans turn red if check-in deadline passes
- **Grace Period** - Buffer time before emergency notification
- **Escalation** - Contacts notified after grace period expires

## 🔧 Configuration

### Environment Variables
The application uses Supabase environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

### Customization

#### Color Scheme
Edit `/styles/globals.css` to customize the nautical color palette:
- Primary: `#0ea5e9` (Ocean Blue)
- Navy: `#0a192f` (Dark Navy)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Amber)
- Danger: `#ef4444` (Red)

#### Boat Types
Edit `/components/BoatsManager.tsx` to add custom boat types:
```typescript
const BOAT_TYPES = [
  'Sailboat',
  'Motorboat',
  'Your Custom Type',
  // ...
]
```

## 🌐 Deployment

### Deploying to Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy frontend**
   - Upload `dist/` folder to your hosting service (Vercel, Netlify, etc.)
   - Or use Supabase hosting

3. **Deploy backend**
   - Supabase Edge Functions are automatically deployed
   - Ensure all environment variables are set in Supabase dashboard

4. **Configure domain**
   - Update CORS settings in `/supabase/functions/server/index.tsx` if using custom domain

### Production Checklist
- [ ] Update Supabase project ID in `/utils/supabase/info.tsx`
- [ ] Set environment variables in Supabase dashboard
- [ ] Enable Row Level Security (RLS) if using Supabase tables
- [ ] Configure email templates for auth (optional)
- [ ] Set up custom domain (optional)
- [ ] Enable analytics/monitoring (optional)

## 🔒 Security

### Authentication
- Email/password authentication via Supabase Auth
- Session management with automatic refresh
- Secure token storage

### Data Protection
- All API routes require authentication
- User data isolated by user ID
- KV store keys prefixed with user ID
- No PII exposure in client-side code

### Best Practices
- All external API calls include error handling
- Toast notifications for user feedback
- Form validation on client and server
- Secure password requirements

## 📊 Data Structure

### KV Store Keys
```
user:{userId}:profile        # User profile data
user:{userId}:boats          # Array of boat objects
user:{userId}:floatplans     # Array of float plan IDs
user:{userId}:contacts       # Array of contact objects
user:{userId}:inventory      # Array of inventory items
user:{userId}:tasks          # Array of seasonal tasks
floatplan:{planId}           # Individual float plan data
```

### Data Models

#### Boat
```typescript
{
  id: string
  name: string
  type: string
  length?: string
  registration?: string
  homePort?: string
  color?: string
  notes?: string
  createdAt: string
  updatedAt?: string
}
```

#### Float Plan
```typescript
{
  id: string
  userId: string
  vesselName: string
  vesselType: string
  departure: string
  destination: string
  route?: string
  checkInDeadline: string
  gracePeriod: number
  crew: string[]
  notes?: string
  status: 'draft' | 'active' | 'checked_in'
  lastCheckIn?: string
  createdAt: string
  updatedAt: string
}
```

## 🤝 Contributing

### Code Standards
- **TypeScript** - Use proper typing for all functions
- **Comments** - Document all components and complex logic
- **Formatting** - Follow existing code style
- **Testing** - Test all user flows before committing

### Component Guidelines
- Each component should have a JSDoc comment
- Use proper prop interfaces
- Handle loading and error states
- Include ARIA labels for accessibility

## 📝 License

This project is licensed under the MIT License.

## 🐛 Known Issues

- Email notifications require Supabase email service setup
- SMS notifications not implemented (placeholder)
- Offline mode not supported yet

## 🚀 Future Enhancements

- [ ] Push notifications for check-in reminders
- [ ] GPS integration for automatic check-ins
- [ ] Weather data integration
- [ ] Document/photo attachments
- [ ] Export float plans as PDF
- [ ] Share float plans with crew
- [ ] Historical trip logs
- [ ] Analytics dashboard

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Check documentation at `/guidelines/Guidelines.md`
- Review Supabase docs at [supabase.com/docs](https://supabase.com/docs)

## ⚓ About

Built for boat owners who value safety and organization. This app helps ensure you never miss a check-in and keeps all your vessel information in one place.

**Stay safe on the water!** 🌊
