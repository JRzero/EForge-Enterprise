package io.eforge.enterprise.workflow.purchase;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.assertj.core.api.Assertions.*;

class PurchaseAmountsTest {
    private PurchaseAmounts.Input line(String id, String quantity, String price) {
        return new PurchaseAmounts.Input(id, "采购物品", "件", quantity, price);
    }
    @Test void roundsEachLineBeforeSummingAndKeepsDecimalStrings() {
        var result = PurchaseAmounts.calculate(List.of(line("a", "0.005", "1.00"), line("b", "0.005", "1.00")));
        assertThat(result.total()).isEqualTo("0.02");
        assertThat(result.lines()).extracting(PurchaseAmounts.Line::amount).containsExactly("0.01", "0.01");
        assertThat(result.lines().get(0).quantity()).isEqualTo("0.005");
        assertThat(result.lines().get(0).unitPrice()).isEqualTo("1.00");
    }
    @Test void decimalArithmeticDoesNotAccumulateBinaryErrors() {
        var result = PurchaseAmounts.calculate(List.of(line("a", "3", "0.10"), line("b", "1", "0.20")));
        assertThat(result.total()).isEqualTo("0.50");
        assertThat(result.lines().get(0).quantity()).isEqualTo("3.000");
    }
    @ParameterizedTest @ValueSource(strings={"0", "-1", "1e2", "NaN", "Infinity", " 1", "1 ", "1.0001", "1000000", ".5", "+1", "01", "１"})
    void rejectsInvalidQuantity(String value) {
        assertInvalid(List.of(line("a",value,"1")));
    }
    @ParameterizedTest @ValueSource(strings={"-0.01", "1e2", "NaN", "1.001", "100000000", "01", " 1", "+1", ".1"})
    void rejectsInvalidPrice(String value) {
        assertInvalid(List.of(line("a","1",value)));
    }
    @Test void zeroPriceIsAllowedAndLargeTotalsAreBounded() {
        assertThat(PurchaseAmounts.calculate(List.of(line("a","1","0"))).total()).isEqualTo("0.00");
        assertInvalid(List.of(line("a","999999.999","99999999.99")));
    }
    @Test void protectsStableIdentitiesAndSnapshotsCallerCollections() {
        var input = new ArrayList<>(List.of(line("a","1","1")));
        var result = PurchaseAmounts.calculate(input);
        input.clear();
        assertThat(result.lines()).hasSize(1);
        assertThatThrownBy(()->result.lines().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertInvalid(List.of(line("a","1","1"),line("a","2","1")));
        assertInvalid(List.of(line("../bad","1","1")));
    }
    @Test void rejectsMissingOverlongOrOversizedRowsWithoutLeakingInput() {
        assertInvalid(null);
        assertInvalid(List.of());
        assertInvalid(java.util.Collections.nCopies(101,line("a","1","1")));
        assertInvalid(java.util.Arrays.asList((PurchaseAmounts.Input)null));
        assertInvalid(List.of(new PurchaseAmounts.Input("a"," ","件","1","1")));
        assertInvalid(List.of(new PurchaseAmounts.Input("a","x".repeat(201),"件","1","1")));
        assertInvalid(List.of(new PurchaseAmounts.Input("a","物品","x".repeat(21),"1","1")));
    }
    private void assertInvalid(List<PurchaseAmounts.Input> rows) {
        assertThatThrownBy(()->PurchaseAmounts.calculate(rows)).isInstanceOfSatisfying(ApiFailure.class,
            failure->{assertThat(failure.status()).isEqualTo(400);assertThat(failure.getMessage()).isEqualTo("采购明细或金额无效。");});
    }
}
