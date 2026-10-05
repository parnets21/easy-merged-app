// src/hooks/useOrders.js
import { useCallback, useEffect, useState } from 'react';
import { orderService } from '../services/orderService';

export default function useOrders(status) {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orderService.list(status ? { status } : {});
      // Raw backend envelope: `{ success, message, data: { orders, pagination } }`.
      // `res.data` is that object (it also carries `pagination`), so it is NOT
      // the row array — unwrap `data.orders` first, then the bare shapes.
      const list =
        (Array.isArray(res?.data) ? res.data : null)
        ?? res?.data?.orders
        ?? res?.orders
        ?? (Array.isArray(res) ? res : []);
      setOrders(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return { orders, loading, error, refetch: load };
}
