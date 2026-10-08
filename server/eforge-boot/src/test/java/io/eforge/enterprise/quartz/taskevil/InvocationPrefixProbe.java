package io.eforge.enterprise.quartz.taskevil;

/** Detects initialization if package-prefix validation accidentally permits this sibling. */
public class InvocationPrefixProbe {
    static {System.setProperty("eforge.owned.invocation.prefix.initialized","unexpected");}
    public void execute() {}
}
