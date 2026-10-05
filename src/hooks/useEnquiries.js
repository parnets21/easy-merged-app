// src/hooks/useEnquiries.js
//
// Mirrors RetailerApp/src/hooks/useEnquiries.js.
//
// The list endpoint may return either a bare array or `{ enquiries, ... }`,
// so both shapes are accepted. The unread counter uses this app's own "new"
// status (`'New'`), matching the pills on EnquiryListScreen.
import { useCallback, useEffect, useState } from 'react';
import { enquiryService } from '../services/enquiryService';

export default function useEnquiries(status) {
  const [enquiries,   setEnquiries]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await enquiryService.list(status ? { status, limit: 100 } : { limit: 100 });
      // This app's api.js returns the RAW backend envelope
      // (`{ success, message, data: { enquiries, pagination } }`), so the rows
      // live at `res.data.enquiries` — NOT `res.data` (that object also carries
      // `pagination`, so `Array.isArray(res.data)` is false). Unwrap deepest
      // first, then fall back to a bare array / bare `{ enquiries }` shape.
      const list =
        (Array.isArray(res?.data) ? res.data : null)
        ?? res?.data?.enquiries
        ?? res?.enquiries
        ?? (Array.isArray(res) ? res : []);
      setEnquiries(Array.isArray(list) ? list : []);
      // Only meaningful on the unfiltered list — a status-filtered fetch would
      // count 0 and flash the badge off.
      if (!status) {
        setUnreadCount((Array.isArray(list) ? list : []).filter(e => e.status === 'New').length);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return { enquiries, loading, error, refetch: load, unreadCount };
}
