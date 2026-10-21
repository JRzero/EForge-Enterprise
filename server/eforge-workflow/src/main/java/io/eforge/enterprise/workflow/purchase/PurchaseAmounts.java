package io.eforge.enterprise.workflow.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Purchase-local CNY policy. Never accepts a caller-calculated line amount or total. */
public final class PurchaseAmounts {
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("999999.999");
    private static final BigDecimal MAX_PRICE = new BigDecimal("99999999.99");
    private static final BigDecimal MAX_TOTAL = new BigDecimal("999999999999.99");
    private PurchaseAmounts() { }
    public record Input(String id, String name, String unit, String quantity, String unitPrice) { }
    public record Line(String id, String name, String unit, String quantity, String unitPrice, String amount) { }
    public record Calculation(List<Line> lines, String total) {
        public Calculation { lines = List.copyOf(lines); }
    }
    public static Calculation calculate(List<Input> input) {
        if (input == null || input.isEmpty() || input.size() > 100) throw invalid();
        var ids = new HashSet<String>();
        var lines = new ArrayList<Line>();
        BigDecimal total = new BigDecimal("0.00");
        for (var row : input) {
            if (row == null || row.id() == null || !row.id().matches("[A-Za-z0-9_-]{1,64}") || !ids.add(row.id())
                || !text(row.name(), 200) || !text(row.unit(), 20)) throw invalid();
            var quantity = decimal(row.quantity(), 3, MAX_QUANTITY);
            if (quantity.signum() <= 0) throw invalid();
            var price = decimal(row.unitPrice(), 2, MAX_PRICE);
            var amount = quantity.multiply(price).setScale(2, RoundingMode.HALF_UP);
            total = total.add(amount);
            if (total.compareTo(MAX_TOTAL) > 0) throw invalid();
            lines.add(new Line(row.id(), row.name(), row.unit(), quantity.toPlainString(), price.toPlainString(), amount.toPlainString()));
        }
        return new Calculation(lines, total.toPlainString());
    }
    private static boolean text(String value, int max) {
        return value != null && !value.isBlank() && value.length() <= max;
    }
    private static BigDecimal decimal(String value, int scale, BigDecimal maximum) {
        if (value == null || value.length() > 20 || !value.matches("(?:0|[1-9][0-9]*)(?:\\.[0-9]{1," + scale + "})?")) throw invalid();
        var result = new BigDecimal(value);
        if (result.compareTo(maximum) > 0) throw invalid();
        return result.setScale(scale);
    }
    private static ApiFailure invalid() { return new ApiFailure(400, "PURCHASE_AMOUNT_INVALID", "采购明细或金额无效。"); }
}
