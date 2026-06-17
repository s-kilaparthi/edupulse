import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { superadminFetch, verifySuperadminSession } from '../utils/superadminAuth'
import Loader from '../components/Loader'

const STAT_CARDS = [
  { key: 'total_institutes', label: 'Total Institutes', icon: '🏫', border: 'border-t-blue-500', badgeKey: 'new_institutes_this_month' },
  { key: 'total_students', label: 'Total Students', icon: '👥', border: 'border-t-emerald-500' },
  { key: 'total_teachers', label: 'Total Teachers', icon: '👨‍🏫', border: 'border-t-violet-500' },
  { key: 'total_exams', label: 'Total Exams', icon: '📝', border: 'border-t-amber-500' },
  { key: 'total_announcements', label: 'Total Announcements', icon: '📢', border: 'border-t-rose-500' },
]

function roleLabel(role) {
  if (!role) return '—'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [authChecking, setAuthChecking] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [stats, setStats] = useState(null)
  const [institutes, setInstitutes] = useState([])
  const [search, setSearch] = useState('')
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingInstitutes, setLoadingInstitutes] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [detailsById, setDetailsById] = useState({})
  const [loadingDetailsId, setLoadingDetailsId] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', brand_name: '', logo_url: '' })
  const [logoUploading, setLogoUploading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const showToast = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const response = await superadminFetch('/superadmin/stats')
      if (!response.ok) throw new Error('Failed to load stats')
      const data = await response.json()
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const loadInstitutes = useCallback(async () => {
    setLoadingInstitutes(true)
    try {
      const response = await superadminFetch('/superadmin/institutes')
      if (!response.ok) throw new Error('Failed to load institutes')
      const data = await response.json()
      setInstitutes(data.institutes ?? [])
    } catch {
      setInstitutes([])
    } finally {
      setLoadingInstitutes(false)
    }
  }, [])

  useEffect(() => {
    async function checkAuth() {
      const { ok, email } = await verifySuperadminSession()
      if (!ok) {
        navigate('/superadmin/login', { replace: true })
        return
      }
      setUserEmail(email ?? '')
      setAuthChecking(false)
    }
    checkAuth()
  }, [navigate])

  useEffect(() => {
    if (authChecking) return
    loadStats()
    loadInstitutes()
  }, [authChecking, loadStats, loadInstitutes])

  const filteredInstitutes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return institutes
    return institutes.filter((inst) => {
      const name = (inst.name ?? '').toLowerCase()
      const city = (inst.city ?? '').toLowerCase()
      return name.includes(q) || city.includes(q)
    })
  }, [institutes, search])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/superadmin/login', { replace: true })
  }

  async function loadInstituteDetails(instituteId) {
    setLoadingDetailsId(instituteId)
    try {
      const response = await superadminFetch(`/superadmin/institute/${instituteId}`)
      if (!response.ok) throw new Error('Failed to load details')
      const data = await response.json()
      setDetailsById((prev) => ({ ...prev, [instituteId]: data }))
    } catch {
      showToast('Failed to load institute details')
    } finally {
      setLoadingDetailsId(null)
    }
  }

  function handleViewDetails(institute) {
    setEditingId(null)
    if (expandedId === institute.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(institute.id)
    if (!detailsById[institute.id]) {
      loadInstituteDetails(institute.id)
    }
  }

  async function openEditPanel(institute) {
    setExpandedId(null)
    setEditingId(institute.id)

    const { data } = await supabase
      .from('institutes')
      .select('name, brand_name, logo_url')
      .eq('id', institute.id)
      .maybeSingle()

    setEditForm({
      name: data?.name ?? institute.name ?? '',
      brand_name: data?.brand_name ?? '',
      logo_url: data?.logo_url ?? '',
    })
  }

  function closeEditPanel() {
    setEditingId(null)
    setEditForm({ name: '', brand_name: '', logo_url: '' })
  }

  async function handleLogoSelect(instituteId, file) {
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      showToast('Please upload a JPG, PNG, or WebP image')
      return
    }

    setLogoUploading(true)
    try {
      const { error } = await supabase.storage
        .from('institute-logos')
        .upload(`${instituteId}/logo`, file, { upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('institute-logos')
        .getPublicUrl(`${instituteId}/logo`)

      setEditForm((prev) => ({ ...prev, logo_url: urlData.publicUrl }))
      showToast('Logo uploaded')
    } catch {
      showToast('Logo upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleSaveEdit(institute) {
    setSavingEdit(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/superadmin/institute/${institute.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          brand_name: editForm.brand_name.trim() || null,
          logo_url: editForm.logo_url || null,
        }),
      })
      if (!response.ok) throw new Error('Update failed')

      setInstitutes((prev) =>
        prev.map((inst) =>
          inst.id === institute.id
            ? {
                ...inst,
                name: editForm.name.trim(),
                brand_name: editForm.brand_name.trim() || null,
                logo_url: editForm.logo_url || null,
              }
            : inst
        )
      )
      closeEditPanel()
      showToast(`${editForm.name.trim()} updated`)
    } catch {
      showToast('Failed to save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleToggleStatus(institute) {
    const isActive = institute.is_active !== false
    const path = isActive
      ? `/superadmin/institute/${institute.id}/suspend`
      : `/superadmin/institute/${institute.id}/activate`

    setActionLoadingId(institute.id)
    try {
      const response = await superadminFetch(path, { method: 'POST' })
      if (!response.ok) throw new Error('Action failed')
      showToast(isActive ? `${institute.name} suspended` : `${institute.name} activated`)
      await loadInstitutes()
      if (expandedId === institute.id) {
        setDetailsById((prev) => {
          const next = { ...prev }
          delete next[institute.id]
          return next
        })
        loadInstituteDetails(institute.id)
      }
    } catch {
      showToast('Action failed. Please try again.')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(institute) {
    setActionLoadingId(institute.id)
    try {
      const response = await superadminFetch(`/superadmin/institute/${institute.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Delete failed')
      setInstitutes((prev) => prev.filter((i) => i.id !== institute.id))
      if (expandedId === institute.id) setExpandedId(null)
      setDeleteTarget(null)
      showToast(`${institute.name} deleted`)
      await loadStats()
    } catch {
      showToast('Delete failed. Please try again.')
    } finally {
      setActionLoadingId(null)
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Verifying access…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">EduPulse Super Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:inline">{userEmail}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Platform Stats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STAT_CARDS.map((card) => (
              <div
                key={card.key}
                className={`bg-white rounded-xl border border-slate-200 border-t-4 ${card.border} shadow-sm p-5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl">{card.icon}</span>
                  {card.badgeKey && stats?.[card.badgeKey] > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      +{stats[card.badgeKey]} this month
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-slate-900 mt-3">
                  {loadingStats ? '—' : (stats?.[card.key] ?? 0)}
                </p>
                <p className="text-sm text-slate-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Institutes
            </h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or city…"
              className="w-full sm:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {loadingInstitutes && (
            <div className="flex justify-center items-center h-64">
              <Loader size={80} />
            </div>
          )}

          {!loadingInstitutes && filteredInstitutes.length === 0 && (
            <p className="text-sm text-slate-500">No institutes found.</p>
          )}

          <div className="space-y-4">
            {filteredInstitutes.map((institute) => {
              const isActive = institute.is_active !== false
              const isExpanded = expandedId === institute.id
              const isEditing = editingId === institute.id
              const details = detailsById[institute.id]
              const isBusy = actionLoadingId === institute.id
                || ((savingEdit || logoUploading) && editingId === institute.id)

              return (
                <div
                  key={institute.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-xl font-semibold text-slate-900">{institute.name}</h3>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {isActive ? '🟢 Active' : '🔴 Suspended'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {[institute.city, institute.state].filter(Boolean).join(', ') || '—'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                            {institute.total_students ?? 0} Students
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                            {institute.total_teachers ?? 0} Teachers
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                            {institute.total_admins ?? 0} Admins
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(institute)}
                          disabled={isBusy}
                          className="text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-60 transition-colors"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => (isEditing ? closeEditPanel() : openEditPanel(institute))}
                          disabled={isBusy}
                          className="text-sm font-medium text-slate-700 border border-slate-300 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                        >
                          {isEditing ? 'Cancel Edit' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(institute)}
                          disabled={isBusy}
                          className={`text-sm font-medium rounded-lg px-3 py-1.5 disabled:opacity-60 transition-colors ${
                            isActive
                              ? 'text-orange-700 border border-orange-200 bg-orange-50 hover:bg-orange-100'
                              : 'text-green-700 border border-green-200 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(institute)}
                          disabled={isBusy}
                          className="text-sm font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg px-3 py-1.5 hover:bg-red-100 disabled:opacity-60 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-5 pt-5 border-t border-slate-200 space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900">Edit Institute</h4>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Institute Name
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Brand Name
                          </label>
                          <input
                            type="text"
                            value={editForm.brand_name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, brand_name: e.target.value }))}
                            placeholder="Short display name e.g. Sri Chaitanya"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Logo
                          </label>
                          {editForm.logo_url && (
                            <img
                              src={editForm.logo_url}
                              alt="Institute logo"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 mb-2"
                            />
                          )}
                          <input
                            type="file"
                            accept={LOGO_ACCEPT}
                            disabled={logoUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleLogoSelect(institute.id, file)
                              e.target.value = ''
                            }}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {logoUploading && (
                            <p className="text-xs text-slate-500 mt-1">Uploading logo…</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(institute)}
                            disabled={savingEdit || !editForm.name.trim()}
                            className="text-sm font-medium text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-60 transition-colors"
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={closeEditPanel}
                            disabled={savingEdit}
                            className="text-sm font-medium text-slate-700 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-slate-200">
                        {loadingDetailsId === institute.id && (
                          <div className="flex justify-center items-center h-32">
                            <Loader size={60} />
                          </div>
                        )}

                        {details && loadingDetailsId !== institute.id && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                              <span><strong>{details.total_classes ?? 0}</strong> Classes</span>
                              <span><strong>{details.total_exams ?? 0}</strong> Exams</span>
                              <span><strong>{details.total_announcements ?? 0}</strong> Announcements</span>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                  <tr>
                                    <th className="text-left px-4 py-2 font-medium">Name</th>
                                    <th className="text-left px-4 py-2 font-medium">Email</th>
                                    <th className="text-left px-4 py-2 font-medium">Role</th>
                                    <th className="text-left px-4 py-2 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(details.users ?? []).map((user) => {
                                    const userActive = user.is_active !== false
                                    return (
                                      <tr key={user.id} className="text-slate-800">
                                        <td className="px-4 py-2">{user.name ?? '—'}</td>
                                        <td className="px-4 py-2">{user.email ?? '—'}</td>
                                        <td className="px-4 py-2">{roleLabel(user.role)}</td>
                                        <td className="px-4 py-2">
                                          <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                              userActive
                                                ? 'bg-green-50 text-green-700'
                                                : 'bg-red-50 text-red-700'
                                            }`}
                                          >
                                            {userActive ? 'Active' : 'Suspended'}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  {(details.users ?? []).length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                                        No users found.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete institute?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Delete {deleteTarget.name}? This will permanently delete all data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoadingId === deleteTarget.id}
                className="text-sm font-medium text-slate-700 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteTarget)}
                disabled={actionLoadingId === deleteTarget.id}
                className="text-sm font-medium text-white bg-red-600 rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-60"
              >
                {actionLoadingId === deleteTarget.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
