import React, { useState, useMemo, useRef } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import foods from "../data/foods.json"; // Certifique-se do caminho correto

const FoodList = () => {
  const [consumedList, setConsumedList] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  // Estados do formulário
  const [editingId, setEditingId] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("");
  // "weight" keeps the typed value in g/ml. "household" is a count of
  // medida_caseira, converted to grams on save.
  const [quantityMode, setQuantityMode] = useState("weight");

  // Estados do Modal de Seleção de Alimento
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef(null);

  // Filtra os alimentos na busca (limitado a 50 para o app continuar leve)
  const filteredFoods = useMemo(() => {
    if (!searchText) return foods.slice(0, 50);
    return foods
      .filter((f) => f.nome.toLowerCase().includes(searchText.toLowerCase()))
      .slice(0, 50);
  }, [searchText]);

  // Calcula o total geral do footer
  const totalCarbs = consumedList.reduce((acc, item) => acc + item.carbs, 0);

  const foodHasWeight = (food) => (food?.peso_g_ml ?? 0) > 0;

  const parseQuantity = (value) => {
    const parsed = parseFloat(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatQuantity = (value) => String(Math.round(value * 100) / 100);

  const formatConsumedQuantity = (item) => {
    if (!foodHasWeight(item.food)) {
      return `${formatQuantity(item.enteredQuantity ?? item.quantity)} un`;
    }

    if (item.quantityMode === "household") {
      return `${formatQuantity(item.enteredQuantity)} × ${item.food.medida_caseira} (${formatQuantity(item.quantity)} g)`;
    }

    return `${formatQuantity(item.quantity)} g/ml`;
  };

  const openFoodSearch = () => {
    setSearchText("");
    setIsModalVisible(true);
  };

  const handleOpenAdd = () => {
    setSelectedFood(null);
    setQuantity("");
    setQuantityMode("weight");
    setEditingId(null);
    setIsFormVisible(true);
    openFoodSearch();
  };

  const handleEdit = (item) => {
    setSelectedFood(item.food);
    setQuantity(String(item.enteredQuantity ?? item.quantity));
    setQuantityMode(
      item.quantityMode || (foodHasWeight(item.food) ? "weight" : "household")
    );
    setEditingId(item.id);
    setIsFormVisible(true);
  };

  const handleSelectFood = (food) => {
    if (!foodHasWeight(food)) {
      setQuantityMode("household");
    }
    setSelectedFood(food);
    setIsModalVisible(false);
  };

  const handleQuantityModeChange = (nextMode) => {
    if (nextMode === quantityMode || !foodHasWeight(selectedFood)) return;

    const current = parseQuantity(quantity);
    if (current != null && current > 0) {
      const portionWeight = selectedFood.peso_g_ml;
      const converted =
        nextMode === "weight" ? current * portionWeight : current / portionWeight;
      setQuantity(formatQuantity(converted));
    }

    setQuantityMode(nextMode);
  };

  const handleDelete = (id) => {
    setConsumedList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!selectedFood || !quantity) {
      Alert.alert("Erro", "Selecione um alimento e informe a quantidade.");
      return;
    }

    const numQty = parseQuantity(quantity);
    if (numQty == null || numQty <= 0) {
      Alert.alert("Erro", "Informe uma quantidade válida.");
      return;
    }

    const hasWeight = foodHasWeight(selectedFood);
    const mode = hasWeight ? quantityMode : "household";
    // Household counts become grams using the portion weight. Foods without a
    // weight stay as a unit count.
    const grams = hasWeight && mode === "household" ? numQty * selectedFood.peso_g_ml : numQty;

    const calculatedCarbs = hasWeight
      ? (grams / selectedFood.peso_g_ml) * selectedFood.cho_g
      : numQty * selectedFood.cho_g;

    const newItem = {
      id: editingId || Date.now().toString(),
      food: selectedFood,
      quantity: grams,
      enteredQuantity: numQty,
      quantityMode: mode,
      carbs: calculatedCarbs,
    };

    if (editingId) {
      setConsumedList((prev) =>
        prev.map((item) => (item.id === editingId ? newItem : item))
      );
    } else {
      setConsumedList((prev) => [...prev, newItem]);
    }

    setIsFormVisible(false);
  };

  // Renderiza a "Nova Linha" de Input
  const renderForm = () => {
    if (!isFormVisible) return null;

    const hasWeight = foodHasWeight(selectedFood);
    const usesHousehold = selectedFood != null && (!hasWeight || quantityMode === "household");
    const typedQuantity = parseQuantity(quantity);
    const gramsPreview =
      hasWeight && usesHousehold && typedQuantity != null && typedQuantity > 0
        ? typedQuantity * selectedFood.peso_g_ml
        : null;

    const quantityLabel = !selectedFood
      ? "Quantidade"
      : usesHousehold
        ? `Quantidade (${selectedFood.medida_caseira})`
        : "Quantidade (g/ml)";

    return (
      <View style={styles.formInset}>
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {editingId ? "Editar Alimento" : "Adicionar Alimento"}
        </Text>
        
        <TouchableOpacity
          style={styles.foodSelector}
          onPress={openFoodSearch}
        >
          <Text style={selectedFood ? styles.foodSelectorText : styles.foodSelectorPlaceholder}>
            {selectedFood ? selectedFood.nome : "Toque para selecionar o alimento..."}
          </Text>
        </TouchableOpacity>

        {hasWeight && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeOption, quantityMode === "household" && styles.modeOptionActive]}
              onPress={() => handleQuantityModeChange("household")}
            >
              <Text style={[styles.modeOptionText, quantityMode === "household" && styles.modeOptionTextActive]}>
                Unidade caseira
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, quantityMode === "weight" && styles.modeOptionActive]}
              onPress={() => handleQuantityModeChange("weight")}
            >
              <Text style={[styles.modeOptionText, quantityMode === "weight" && styles.modeOptionTextActive]}>
                Peso (g/ml)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{quantityLabel}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={usesHousehold ? "Ex: 2" : "Ex: 150"}
              value={quantity}
              onChangeText={setQuantity}
            />
            {gramsPreview != null && (
              <Text style={styles.conversionHint}>
                {formatQuantity(typedQuantity)} × {selectedFood.medida_caseira} = {formatQuantity(gramsPreview)} g
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnCancel]}
            onPress={() => setIsFormVisible(false)}
          >
            <Text style={styles.btnTextCancel}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSave}>
            <Text style={styles.btnTextSave}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Refeição</Text>
        {!isFormVisible && (
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Text style={styles.addBtnText}>+ Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        {renderForm()}

      {/* LISTA */}
      <FlatList
        style={styles.list}
        data={consumedList}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !isFormVisible ? (
            <Text style={styles.emptyText}>Sua lista está vazia.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.food.nome}</Text>
              <Text style={styles.itemDetails}>
                {formatConsumedQuantity(item)} • {item.carbs.toFixed(1)}g Carbo
              </Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}>
                <Text style={styles.actionTextBlue}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.actionTextRed}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
      </View>

      {/* FOOTER - OVERALL */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>Total de Carboidratos:</Text>
        <Text style={styles.footerTotal}>{totalCarbs.toFixed(1)} g</Text>
      </View>

      {/* MODAL DE SELEÇÃO DE ALIMENTOS */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={false}
        onShow={() => {
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar Alimento</Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Text style={styles.actionTextBlue}>Fechar</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Digite o nome do alimento..."
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />

          <FlatList
            data={filteredFoods}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.foodOption}
                onPress={() => handleSelectFood(item)}
              >
                <Text style={styles.foodOptionName}>{item.nome}</Text>
                <Text style={styles.foodOptionDetails}>
                  Porção base: {item.medida_caseira} ({item.peso_g_ml > 0 ? `${item.peso_g_ml}g` : "Unidade"}) • {item.cho_g}g de CHO
                </Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  body: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 20, flexGrow: 1 },
  formInset: { paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: "#E5E5E5"
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#333" },
  addBtn: { backgroundColor: "#007BFF", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  
  emptyText: { textAlign: "center", color: "#999", marginTop: 40, fontSize: 16 },
  
  formContainer: { backgroundColor: "#FFF", padding: 15, borderRadius: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4 },
  formTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, color: "#333" },
  foodSelector: { padding: 15, backgroundColor: "#F0F0F0", borderRadius: 8, marginBottom: 15 },
  foodSelectorText: { fontSize: 16, color: "#333", fontWeight: "500" },
  foodSelectorPlaceholder: { fontSize: 16, color: "#888" },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 14, color: "#555", marginBottom: 5 },
  input: { backgroundColor: "#F0F0F0", padding: 12, borderRadius: 8, fontSize: 16 },
  modeToggle: { flexDirection: "row", backgroundColor: "#F0F0F0", borderRadius: 8, padding: 4, marginBottom: 15 },
  modeOption: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: "center" },
  modeOptionActive: { backgroundColor: "#FFF" },
  modeOptionText: { fontSize: 14, color: "#666", fontWeight: "600" },
  modeOptionTextActive: { color: "#007BFF" },
  conversionHint: { marginTop: 8, fontSize: 13, color: "#555" },
  actionButtons: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },
  btnCancel: { backgroundColor: "#E5E5E5" },
  btnSave: { backgroundColor: "#28A745" },
  btnTextCancel: { color: "#333", fontWeight: "bold" },
  btnTextSave: { color: "#FFF", fontWeight: "bold" },

  listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF", padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  itemDetails: { fontSize: 14, color: "#666", marginTop: 4 },
  itemActions: { flexDirection: "row", alignItems: "center" },
  editBtn: { marginRight: 15 },
  actionTextBlue: { color: "#007BFF", fontWeight: "bold" },
  actionTextRed: { color: "#DC3545", fontWeight: "bold" },

  footer: { flexDirection: "row", justifyContent: "space-between", padding: 25, backgroundColor: "#FFF", borderTopWidth: 1, borderColor: "#E5E5E5" },
  footerLabel: { fontSize: 18, fontWeight: "bold", color: "#333" },
  footerTotal: { fontSize: 20, fontWeight: "bold", color: "#28A745" },

  modalContainer: { flex: 1, backgroundColor: "#FFF" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderColor: "#E5E5E5" },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  searchInput: { margin: 20, padding: 15, backgroundColor: "#F0F0F0", borderRadius: 8, fontSize: 16 },
  foodOption: { padding: 15, borderBottomWidth: 1, borderColor: "#EFEFEF" },
  foodOptionName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  foodOptionDetails: { fontSize: 14, color: "#666", marginTop: 4 }
});

export default FoodList;