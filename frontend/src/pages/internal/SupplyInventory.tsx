import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface Supply {
  id: string;
  name: string;
  current_stock: number;
  reorder_level: number;
  unit: string;
  cost_per_unit: number;
  supplier: string;
  last_reordered: string;
}

const SupplyInventory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');

  const recordingMode = !!shipmentId;
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplies, setSelectedSupplies] = useState<{ [key: string]: number }>({});
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchSupplies();
  }, []);

  const fetchSupplies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/processing/supplies');
      setSupplies(response.data.supplies || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load supplies');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (supplyId: string, quantity: number) => {
    setSelectedSupplies((prev) => ({
      ...prev,
      [supplyId]: quantity,
    }));
  };

  const handleRecordSupplies = async () => {
    if (!shipmentId) {
      toast.error('Shipment ID not found');
      return;
    }

    const usedSupplies = Object.entries(selectedSupplies)
      .filter(([_, qty]) => qty > 0)
      .map(([supplyId, quantity]) => ({ supplyId, quantity }));

    if (usedSupplies.length === 0) {
      toast.warning('Please select at least one supply');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/processing/shipments/${shipmentId}/record-supplies`, {
        supplies: usedSupplies,
        notes: notes || undefined,
      });

      toast.success('Supplies recorded successfully');
      navigate('/internal/processing-dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record supplies');
    } finally {
      setSubmitting(false);
    }
  };

  const getStockStatus = (current: number, reorder: number) => {
    if (current <= reorder) {
      return { color: '#dc3545', text: 'REORDER NEEDED', emoji: '❌' };
    } else if (current < reorder * 1.5) {
      return { color: '#ffc107', text: 'LOW STOCK', emoji: '⚠️' };
    } else {
      return { color: '#28a745', text: 'IN STOCK', emoji: '✅' };
    }
  };

  const totalRecordedCost = Object.entries(selectedSupplies)
    .reduce((total, [supplyId, quantity]) => {
      const supply = supplies.find((s) => s.id === supplyId);
      return supply ? total + supply.cost_per_unit * quantity : total;
    }, 0)
    .toFixed(2);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(recordingMode ? '/internal/processing-dashboard' : '/')} style={styles.backButton}>
          ← Back
        </button>
        <h1 style={styles.title}>
          {recordingMode ? 'Record Supplies Used' : 'Supply Inventory'}
        </h1>
        {recordingMode && (
          <p style={styles.subtitle}>Select supplies used for this shipment</p>
        )}
      </div>

      {/* Summary Card */}
      {!recordingMode && (
        <div style={styles.summaryCard}>
          <div style={styles.summaryItem}>
            <p style={styles.summaryLabel}>Total Items</p>
            <p style={styles.summaryCount}>{supplies.length}</p>
          </div>
          <div style={styles.summaryItem}>
            <p style={styles.summaryLabel}>Reorder Needed</p>
            <p style={{ ...styles.summaryCount, color: '#dc3545' }}>
              {supplies.filter((s) => s.current_stock <= s.reorder_level).length}
            </p>
          </div>
          <div style={styles.summaryItem}>
            <p style={styles.summaryLabel}>Low Stock</p>
            <p style={{ ...styles.summaryCount, color: '#ffc107' }}>
              {supplies.filter((s) => s.current_stock < s.reorder_level * 1.5 && s.current_stock > s.reorder_level).length}
            </p>
          </div>
        </div>
      )}

      {/* Supplies Grid */}
      <div style={styles.suppliesContainer}>
        {loading ? (
          <div style={styles.loadingMessage}>
            <p>Loading supplies...</p>
          </div>
        ) : supplies.length === 0 ? (
          <div style={styles.emptyMessage}>
            <p style={styles.emptyIcon}>📦</p>
            <p style={styles.emptyText}>No supplies configured</p>
          </div>
        ) : (
          <div style={styles.suppliesGrid}>
            {supplies.map((supply) => {
              const status = getStockStatus(supply.current_stock, supply.reorder_level);
              const selectedQty = selectedSupplies[supply.id] || 0;

              return (
                <div key={supply.id} style={styles.supplyCard}>
                  {/* Status Badge */}
                  <div
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: status.color,
                    }}
                  >
                    <span>{status.emoji}</span> {status.text}
                  </div>

                  {/* Supply Info */}
                  <h3 style={styles.supplyName}>{supply.name}</h3>

                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Current Stock</span>
                      <span style={styles.infoValue}>
                        {supply.current_stock} {supply.unit}
                      </span>
                    </div>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Reorder Level</span>
                      <span style={styles.infoValue}>
                        {supply.reorder_level} {supply.unit}
                      </span>
                    </div>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Cost Per Unit</span>
                      <span style={styles.infoValue}>${supply.cost_per_unit.toFixed(2)}</span>
                    </div>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Supplier</span>
                      <span style={styles.infoValue}>{supply.supplier}</span>
                    </div>
                  </div>

                  {recordingMode && (
                    <div style={styles.recordingSection}>
                      <label style={styles.recordingLabel}>
                        Quantity Used ({supply.unit}):
                      </label>
                      <div style={styles.inputGroup}>
                        <button
                          onClick={() => handleQuantityChange(supply.id, Math.max(0, selectedQty - 1))}
                          style={styles.minusButton}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={selectedQty}
                          onChange={(e) =>
                            handleQuantityChange(supply.id, Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          min="0"
                          max={supply.current_stock}
                          style={styles.quantityInput}
                        />
                        <button
                          onClick={() => handleQuantityChange(supply.id, selectedQty + 1)}
                          style={styles.plusButton}
                        >
                          +
                        </button>
                      </div>
                      {selectedQty > 0 && (
                        <p style={styles.costDisplay}>
                          Cost: ${(supply.cost_per_unit * selectedQty).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {!recordingMode && supply.last_reordered && (
                    <p style={styles.lastReordered}>
                      Last reordered: {new Date(supply.last_reordered).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recordingMode && (
        <>
          {/* Notes Section */}
          <div style={styles.notesSection}>
            <label htmlFor="notes" style={styles.notesLabel}>
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.notesInput}
              placeholder="Add any additional notes about supply usage..."
              maxLength={500}
            />
            <span style={styles.charCount}>{notes.length}/500</span>
          </div>

          {/* Summary */}
          {Object.values(selectedSupplies).some((qty) => qty > 0) && (
            <div style={styles.summaryBox}>
              <h3 style={styles.summaryBoxTitle}>Recording Summary</h3>
              <div style={styles.summaryList}>
                {Object.entries(selectedSupplies)
                  .filter(([_, qty]) => qty > 0)
                  .map(([supplyId, quantity]) => {
                    const supply = supplies.find((s) => s.id === supplyId);
                    return supply ? (
                      <div key={supplyId} style={styles.summaryListItem}>
                        <span>{supply.name}</span>
                        <span>
                          {quantity} {supply.unit} × ${supply.cost_per_unit.toFixed(2)} = $
                          {(quantity * supply.cost_per_unit).toFixed(2)}
                        </span>
                      </div>
                    ) : null;
                  })}
              </div>
              <div style={styles.totalCost}>
                <span>Total Cost:</span>
                <span>${totalRecordedCost}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleRecordSupplies}
            style={{
              ...styles.submitButton,
              opacity: Object.values(selectedSupplies).some((qty) => qty > 0) ? 1 : 0.5,
              cursor: Object.values(selectedSupplies).some((qty) => qty > 0) ? 'pointer' : 'not-allowed',
            }}
            disabled={submitting || !Object.values(selectedSupplies).some((qty) => qty > 0)}
          >
            {submitting ? 'Recording...' : 'Record Supplies Used'}
          </button>
        </>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '30px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '12px',
    fontWeight: '500',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '8px 0 0 0',
  },
  summaryCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  summaryItem: {
    textAlign: 'center' as const,
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#666',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
  },
  summaryCount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  suppliesContainer: {
    marginBottom: '30px',
  },
  loadingMessage: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666',
  },
  emptyMessage: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  emptyIcon: {
    fontSize: '48px',
    margin: 0,
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    margin: '12px 0 0 0',
  },
  suppliesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  supplyCard: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '16px',
    position: 'relative' as const,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    color: 'white',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    marginBottom: '12px',
  },
  supplyName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  infoLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  infoValue: {
    fontSize: '13px',
    color: '#333',
    fontWeight: '500',
  },
  recordingSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  recordingLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#333',
  },
  inputGroup: {
    display: 'flex',
    gap: '4px',
  },
  minusButton: {
    padding: '6px 8px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  quantityInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '2px',
    textAlign: 'center' as const,
  },
  plusButton: {
    padding: '6px 8px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  costDisplay: {
    fontSize: '12px',
    color: '#28a745',
    fontWeight: 'bold',
    margin: '0',
    textAlign: 'right' as const,
  },
  lastReordered: {
    fontSize: '11px',
    color: '#999',
    margin: '12px 0 0 0',
  },
  notesSection: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  notesLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    display: 'block',
    marginBottom: '8px',
  },
  notesInput: {
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box' as const,
    minHeight: '80px',
    resize: 'vertical' as const,
  },
  charCount: {
    fontSize: '11px',
    color: '#999',
    textAlign: 'right' as const,
    display: 'block',
    marginTop: '4px',
  },
  summaryBox: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  summaryBoxTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  summaryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #dee2e6',
  },
  summaryListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#333',
  },
  totalCost: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default SupplyInventory;
